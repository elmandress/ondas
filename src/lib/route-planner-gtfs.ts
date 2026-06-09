/**
 * Planificador multimodal real usando GTFS oficial.
 *
 * SRS FR-4 (motor Raptor simplificado server-side).
 *
 * Algoritmo:
 *   1. Encontrar paradas cerca del origen (radio walkRadiusM) y del destino
 *   2. Camino DIRECTO: para cada (origin_stop, dest_stop), buscar variantes
 *      del GTFS que pasen por ambas EN ORDEN (origen_seq < dest_seq)
 *   3. Camino con 1 TRANSBORDO: para cada parada del origen, listar variantes
 *      que la sirvan. Para cada parada de paso, listar variantes hacia el destino.
 *      Encontrar matches.
 *   4. Ordenar por tiempo total (caminar + esperar + bus + caminar)
 *
 * Diferencia clave vs `route-planner.ts` heurístico:
 *   - Usa datos GTFS reales (parada X PASA por variante Y, no asumir compartido por línea)
 *   - Calcula tiempo de bus por `arrival_seconds` del GTFS (oficial)
 *   - Filtra por dirección (variante = sentido)
 *
 * Server-only.
 */

import type { StopRecord } from "@/lib/stops-dataset";
import { getStopsServerSync } from "@/lib/stops-server";
import { haversineMeters } from "@/lib/geo";
import {
  getAllVariantsAtStop,
  getDownstreamStops,
  getStopsBetween,
} from "@/lib/gtfs-db";
import { getLineHoursLookup, type LineHoursLookup } from "@/lib/line-hours";
import { getNextScheduledPerLine, getTipoDia, type TipoDia } from "@/lib/schedule-db";

const WALK_SPEED_MS = 1.25;            // 4.5 km/h (igual que walkingMinutes en utils.ts)
const BUS_WAIT_DEFAULT_S = 360;        // 6 min — fallback si schedule.db no disponible
const TRANSFER_WAIT_S = 240;           // 4 min de espera al transbordo
const MAX_WALK_TO_STOP_M = 1500;
/** Si origen y destino están a menos de esto, ofrecer caminar como opción. */
const WALK_ONLY_MAX_M = 2500;
/** Distancia máxima a pie para caminar entre paradas en un transbordo.
 *  Más de esto deja de ser razonable (la gente prefiere otra ruta). */
const MAX_TRANSFER_WALK_M = 350;

export interface PlanOptions {
  walkRadiusM?: number;
  maxResults?: number;
  /** Permite 0 (solo directos) o 1 (con transbordos). Default 1. */
  maxTransfers?: 0 | 1;
  /** Fecha/hora "ahora" para filtrar líneas no operativas. Default: Date.now().
   *  Si se pasa null, no se filtra por horario (modo "ver todas las opciones posibles"). */
  now?: Date | null;
  /** Ventana en min para "está por pasar" (default 90). Una línea pasa el filtro si
   *  tiene servicio dentro de [now, now+window]. */
  operatingWindowMin?: number;
  /** Hora de salida deseada (futura). Si se pasa, las esperas y el filtro de horario
   *  se calculan respecto a esta hora, no a "ahora" → "salir 21:30". */
  departAt?: Date | null;
}

export interface RouteLeg {
  type: "walk" | "bus";
  fromStopId?: string;
  fromStopName?: string;
  toStopId?: string;
  toStopName?: string;
  /** Líneas que pueden tomarse para este leg (varias variantes compatibles). */
  lines?: string[];
  /** Variante representativa (para mostrar destino). */
  headsign?: string;
  /** Cantidad de paradas en el bus. */
  numStops?: number;
  /** Duración en segundos. */
  durationS: number;
  /** Distancia en metros (caminata: haversine, bus: por recorrido GTFS). */
  distanceM: number;
  /** Polyline para dibujar en el mapa.
   *  - bus: coords de cada parada del trip entre origen y destino
   *  - walk: 2 puntos (origen y destino), el cliente puede pedir OSRM si quiere detalle por calles
   *  Formato: [[lat,lon], ...]
   */
  polyline?: [number, number][];
  /** Solo para bus: variantId GTFS (para que el cliente pida la polyline real si quiere). */
  variantId?: string;
  /** Solo para bus: la línea cierra dentro de los próximos ~45min. La UI debe
   *  destacarlo ("última corrida 22:45") para que el usuario no se quede tirado. */
  closingSoon?: boolean;
  /** Solo para bus: minuto del día (0-1439) cuando deja de operar el bloque actual.
   *  Útil para mostrar la hora exacta. */
  endOfServiceMin?: number;
}

export interface PlannedRoute {
  totalSeconds: number;
  totalWalkM: number;
  numTransfers: number;
  legs: RouteLeg[];
  /** Signature semántica para deduplicación. Ejemplos:
   *   - "walk"          → opción caminando
   *   - "direct:183"    → cualquier 183 directo
   *   - "transfer:181+174" → transbordo entre líneas (ordenado alfabético)
   */
  signature: string;
  /** Alternativas equivalentes (mismo signature, distintas paradas/headsigns).
   *  La UI puede mostrarlas como "o tomarlo en X" sin saturar. */
  alternatives?: number;
  /** El "transbordo" es entre dos variantes de la MISMA línea (ej. 183→183): la
   *  línea cambia de recorrido. Honestidad: no es magia, puede que sigas en el
   *  mismo coche o tomes el próximo de la misma línea. La UI lo aclara. */
  sameLineContinuation?: boolean;
  /** Ruta encadenada por paradas intermedias (waypoints). Cada elemento es el
   *  nombre del punto intermedio donde el viaje hace una parada deliberada. */
  viaWaypoints?: string[];
}

// Distancia: usa la utilidad geográfica única (lib/geo). Alias local para no tocar callsites.
const haversineM = haversineMeters;

interface NearStop { stop: StopRecord; walkM: number; walkS: number; }

/**
 * Polyline del bus leg = paradas del tramo conectadas (líneas rectas, barato).
 *
 * NO clipeamos el shape de routes.json acá: el CLIENTE (useEnrichedRouteLegs) ya
 * reemplaza esta polyline por el trazo real por calles (sliceBusPolyline) tanto en
 * Rutas como en el Mapa, y fija los extremos a la parada exacta. Hacer el clip en el
 * server, por cada leg de CADA candidato, costaba >5s en rutas largas (regresión de
 * perf). Lo dejamos liviano: el server solo da un trazo aproximado para el render
 * inicial; el cliente lo enriquece.
 */
function buildBusLegPolyline(
  variantId: string,
  fromSeq: number,
  toSeq: number,
  stopsById: Map<string, StopRecord>,
): [number, number][] {
  const intermediates = getStopsBetween(variantId, fromSeq, toSeq);
  const stopCoords: [number, number][] = [];
  for (const s of intermediates) {
    const stop = stopsById.get(s.stopId);
    if (stop) stopCoords.push([stop.stopLat, stop.stopLon]);
  }
  return stopCoords;
}

function findStopsNear(point: { lat: number; lon: number }, radiusM: number, limit: number): NearStop[] {
  const all = getStopsServerSync();
  const results: NearStop[] = [];
  for (const s of all) {
    const d = haversineM(point.lat, point.lon, s.stopLat, s.stopLon);
    if (d <= radiusM) {
      results.push({ stop: s, walkM: d, walkS: Math.round(d / WALK_SPEED_MS) });
    }
  }
  results.sort((a, b) => a.walkM - b.walkM);
  return results.slice(0, limit);
}

/**
 * Grid espacial para búsqueda rápida de paradas vecinas.
 * Indexa por celda de ~500m (~0.005° lat, ~0.005° lon en MVD).
 * Necesario porque en el loop de transbordos, buscar paradas a <300m
 * de cada parada del bus 1 sería O(N) por iteración → O(N²) total.
 */
interface StopGrid {
  cellSize: number; // grados
  cells: Map<string, StopRecord[]>;
}

function buildStopGrid(stopsById: Map<string, StopRecord>): StopGrid {
  // 0.005° ≈ 555m en lat, ~460m en lon a -34.9. Usamos celda 0.005°.
  const cellSize = 0.005;
  const cells = new Map<string, StopRecord[]>();
  for (const s of stopsById.values()) {
    const key = `${Math.floor(s.stopLat / cellSize)},${Math.floor(s.stopLon / cellSize)}`;
    const arr = cells.get(key);
    if (arr) arr.push(s); else cells.set(key, [s]);
  }
  return { cellSize, cells };
}

// Caches a nivel módulo: el dataset de paradas (~10k con el metro) es constante en
// runtime. Construir el Map y el grid en CADA plan era O(N) repetido y caro tras
// sumar Canelones. Se construyen una vez (lazy) y se reusan en todas las llamadas.
let _allStopsByIdCache: Map<string, StopRecord> | null = null;
let _stopGridCache: StopGrid | null = null;
function getAllStopsByIdCached(): Map<string, StopRecord> {
  if (!_allStopsByIdCache) {
    _allStopsByIdCache = new Map(getStopsServerSync().map((s) => [s.stopId, s]));
  }
  return _allStopsByIdCache;
}
function getStopGridCached(stopsById: Map<string, StopRecord>): StopGrid {
  if (!_stopGridCache) _stopGridCache = buildStopGrid(stopsById);
  return _stopGridCache;
}

function nearbyStopsFromGrid(
  grid: StopGrid,
  origin: { stopLat: number; stopLon: number },
  radiusM: number,
): Array<{ stop: StopRecord; distM: number }> {
  const { cellSize, cells } = grid;
  const baseRow = Math.floor(origin.stopLat / cellSize);
  const baseCol = Math.floor(origin.stopLon / cellSize);
  const out: Array<{ stop: StopRecord; distM: number }> = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const bucket = cells.get(`${baseRow + dr},${baseCol + dc}`);
      if (!bucket) continue;
      for (const s of bucket) {
        const d = haversineM(origin.stopLat, origin.stopLon, s.stopLat, s.stopLon);
        if (d <= radiusM) out.push({ stop: s, distM: d });
      }
    }
  }
  out.sort((a, b) => a.distM - b.distM);
  return out;
}

/**
 * Para una parada de origen y un set de paradas de destino, encuentra todas las
 * variantes que conectan directamente (origen.seq < destino.seq en la misma variante).
 *
 * Devuelve agrupado por (línea, destino) para mostrar varias líneas alternativas en un leg.
 */
function findDirectVariants(
  fromStopId: string,
  toStopIds: Set<string>
): Array<{
  fromVariantId: string;
  shortName: string;
  headsign: string;
  fromSeq: number;
  toStopId: string;
  toSeq: number;
  toArrivalSeconds: number;
  fromArrivalSeconds: number;
  numStops: number;
}> {
  const variantsAtFrom = getAllVariantsAtStop(fromStopId);
  const matches: Array<ReturnType<typeof toMatch>> = [];

  for (const v of variantsAtFrom) {
    const downstream = getDownstreamStops(v.variantId, v.sequence);
    for (const ds of downstream) {
      if (toStopIds.has(ds.stopId)) {
        matches.push(toMatch(v, ds));
      }
    }
  }

  return matches;

  function toMatch(v: ReturnType<typeof getAllVariantsAtStop>[0], ds: ReturnType<typeof getDownstreamStops>[0]) {
    return {
      fromVariantId: v.variantId,
      shortName: v.shortName,
      headsign: v.headsign,
      fromSeq: v.sequence,
      toStopId: ds.stopId,
      toSeq: ds.sequence,
      toArrivalSeconds: ds.arrivalSeconds,
      fromArrivalSeconds: v.arrivalSeconds,
      numStops: ds.sequence - v.sequence,
    };
  }
}

/**
 * Construye la "signature semántica" de una ruta. Dos rutas con la misma signature
 * son equivalentes para el usuario y solo debemos mostrar una.
 *
 * Reglas:
 *  - "walk" → siempre única
 *  - "direct:L" → cualquier 183 directo cuenta como UN resultado
 *  - "transfer:L1+L2" → orden alfabético, mismo par de líneas
 *
 * NO incluye stopIds ni headsigns — esos son detalles, no opciones distintas.
 */
/** Normaliza nombre de línea: saca sufijos de día como " Sd", "Sd", "S", "D".
 *  "124 Sd" y "124" son la misma línea operando en distintos días. */
function normalizeLineName(line: string): string {
  return line.replace(/\s+(Sd|Sa|D|N)$/i, "").trim();
}

function buildSignature(route: Omit<PlannedRoute, "signature">): string {
  if (route.legs.length === 1 && route.legs[0].type === "walk") return "walk";
  // Cada tramo de bus → su CONJUNTO de líneas (ordenado). Así "64/76/187 desde A" es
  // una opción distinta de "64 desde B", y dos tramos con el mismo set se deduplican.
  const busLegs = route.legs
    .filter((l) => l.type === "bus")
    .map((l) => (l.lines ?? []).map(normalizeLineName).sort().join("/"));
  if (busLegs.length === 1) return `direct:${busLegs[0]}`;
  return `transfer:${busLegs.join("+")}`;
}

/**
 * Calcula el tiempo de espera real en una parada para una lista de líneas,
 * consultando schedule.db. Devuelve el mínimo entre las líneas (tomas el
 * primer bus que llegue). Fallback a BUS_WAIT_DEFAULT_S si no hay datos.
 */
function realWaitSeconds(stopId: string, lines: string[], refMinutes?: number, refTipoDia?: TipoDia): number {
  try {
    const scheduled = getNextScheduledPerLine(stopId, lines, 120, refMinutes, refTipoDia);
    if (!scheduled.length) return BUS_WAIT_DEFAULT_S;
    const minWait = Math.min(...scheduled.map((s) => s.minutesFromNow));
    // Si el próximo pasa en ≤0 min (ahora) o >90 min (no práctico), usar default
    if (minWait <= 0) return 60; // acaba de pasar, el siguiente en ~1min
    if (minWait > 90) return BUS_WAIT_DEFAULT_S;
    return minWait * 60;
  } catch {
    return BUS_WAIT_DEFAULT_S;
  }
}

export function planRoutesGtfs(
  origin: { lat: number; lon: number },
  destination: { lat: number; lon: number },
  options: PlanOptions = {}
): PlannedRoute[] {
  const {
    walkRadiusM = MAX_WALK_TO_STOP_M,
    maxResults = 5,
    maxTransfers = 1,
    now,
    operatingWindowMin = 90,
    departAt,
  } = options;

  // departAt (hora de salida futura) manda sobre "ahora" para TODO lo de horario:
  // el filtro de líneas operativas y el cálculo de espera al bus. Así "salir 21:30"
  // refleja qué corre y cuánto se espera a esa hora, no ahora.
  const refDate = departAt ?? (now ?? null);
  const refMinutes = refDate ? refDate.getHours() * 60 + refDate.getMinutes() : undefined;
  const refTipoDia: TipoDia | undefined = refDate ? getTipoDia(refDate) : undefined;

  // Filtro de horario operativo: si now === null, no filtramos.
  // Si no se pasa, usamos new Date() para filtrar líneas que no operan ahora.
  const hoursLookup: LineHoursLookup | null =
    now === null ? null : getLineHoursLookup(departAt ?? now ?? new Date());
  const isLineOperating = (line: string): boolean => {
    if (!hoursLookup) return true;
    return hoursLookup.operatesNowOrSoon(line, operatingWindowMin);
  };
  const annotateBusLeg = (leg: RouteLeg): RouteLeg => {
    if (!hoursLookup || leg.type !== "bus" || !leg.lines?.length) return leg;
    const line = leg.lines[0];
    const end = hoursLookup.endOfCurrentBlock(line);
    if (end === null) return leg;
    return { ...leg, endOfServiceMin: end, closingSoon: hoursLookup.closingSoon(line, 45) };
  };

  // Memo de espera por (parada + líneas) DENTRO de esta planificación: realWaitSeconds
  // pega a schedule.db (84MB) y antes se recomputaba decenas de veces en el loop de
  // transbordos con los mismos argumentos. Cachear acá baja el p95 drásticamente.
  const waitCache = new Map<string, number>();
  const cachedWait = (stopId: string, lines: string[]): number => {
    const key = `${stopId}|${lines.join(",")}`;
    let v = waitCache.get(key);
    if (v === undefined) { v = realWaitSeconds(stopId, lines, refMinutes, refTipoDia); waitCache.set(key, v); }
    return v;
  };

  const directDistM = haversineM(origin.lat, origin.lon, destination.lat, destination.lon);

  // ¿El viaje es 100% dentro de Montevideo? Las líneas METROPOLITANAS (variant_id "M-…",
  // suburbanas de Canelones) también pasan por MVD, pero NO deben usarse para un viaje
  // intra-MVD: las urbanas STM cubren todo y son las que la gente toma. Solo permitimos
  // las metro cuando origen o destino están en Canelones (fuera de MVD). Esto arregla el
  // bug de "centro→Nuevocentro me da un suburbano" y la bandera "metropolitano" en todo.
  const inMvd = (lat: number, lon: number) =>
    lat <= -34.78 && lat >= -34.96 && lon <= -56.05 && lon >= -56.46;
  const intraMvd = inMvd(origin.lat, origin.lon) && inMvd(destination.lat, destination.lon);
  const isMetroVariant = (variantId: string) => variantId.startsWith("M-");
  const allowVariant = (variantId: string) => !intraMvd || !isMetroVariant(variantId);

  const fromStops = findStopsNear(origin, walkRadiusM, 15);
  const toStops = findStopsNear(destination, walkRadiusM, 15);

  const toStopIds = new Set(toStops.map((t) => t.stop.stopId));
  const toStopById = new Map(toStops.map((t) => [t.stop.stopId, t]));

  // Memo de directas por parada: findDirectVariants pega varias veces a la DB
  // (variantes + downstream) y en el loop de transbordos se la llama miles de veces
  // con el MISMO toStopIds. Cachear por stopId baja el p95 de rutas largas de ~6s a <1s.
  const directsCache = new Map<string, ReturnType<typeof findDirectVariants>>();
  const cachedDirects = (stopId: string) => {
    let v = directsCache.get(stopId);
    if (v === undefined) {
      v = findDirectVariants(stopId, toStopIds).filter((m) => allowVariant(m.fromVariantId));
      directsCache.set(stopId, v);
    }
    return v;
  };

  // Mapa de todas las paradas por id (para polylines). Cacheado a nivel módulo:
  // el dataset (~10k paradas con el metro de Canelones) no cambia entre llamadas;
  // reconstruir el Map en cada plan costaba ~50-100ms de más por viaje.
  const allStopsById = getAllStopsByIdCached();

  // Memo de polylines de tramo: buildBusLegPolyline pega a getStopsBetween (DB) y en
  // el loop de transbordo se llama 2× por candidato. Muchos candidatos comparten el
  // mismo (variante, tramo) → cachear por clave evita miles de consultas repetidas.
  const polylineCache = new Map<string, [number, number][]>();
  const cachedPolyline = (variantId: string, fromSeq: number, toSeq: number): [number, number][] => {
    const key = `${variantId}|${fromSeq}|${toSeq}`;
    let v = polylineCache.get(key);
    if (v === undefined) { v = buildBusLegPolyline(variantId, fromSeq, toSeq, allStopsById); polylineCache.set(key, v); }
    return v;
  };

  const candidates: PlannedRoute[] = [];

  // ─── OPCIÓN CAMINAR (si <2.5km) ───
  if (directDistM <= WALK_ONLY_MAX_M) {
    const walkS = Math.round(directDistM / WALK_SPEED_MS);
    candidates.push({
      totalSeconds: walkS,
      totalWalkM: Math.round(directDistM),
      numTransfers: 0,
      signature: "walk",
      legs: [
        {
          type: "walk",
          durationS: walkS,
          distanceM: Math.round(directDistM),
          polyline: [[origin.lat, origin.lon], [destination.lat, destination.lon]],
        },
      ],
    });
  }

  if (fromStops.length === 0 || toStops.length === 0) {
    return candidates;
  }

  // ─── RUTAS DIRECTAS ───
  // FR-4 (feedback Guille): agrupar TODAS las líneas que sirven el mismo tramo
  // (misma parada de origen → misma de bajada) en UNA sola opción → "Tomá el 64, 76 o 187",
  // en vez de una tarjeta por línea (o cortar alternativas con maxResults).
  for (const f of fromStops.slice(0, 10)) {
    const directs = cachedDirects(f.stop.stopId);

    // Agrupar por parada de bajada.
    const byToStop = new Map<string, ReturnType<typeof findDirectVariants>>();
    for (const m of directs) {
      if (!toStopById.has(m.toStopId)) continue;
      if (!isLineOperating(m.shortName)) continue;
      const arr = byToStop.get(m.toStopId);
      if (arr) arr.push(m); else byToStop.set(m.toStopId, [m]);
    }

    for (const [toStopId, group] of byToStop) {
      const toNear = toStopById.get(toStopId)!;
      // Representante = el de menor tiempo de bus (la mejor de las líneas del tramo).
      group.sort((a, b) => (a.toArrivalSeconds - a.fromArrivalSeconds) - (b.toArrivalSeconds - b.fromArrivalSeconds));
      const best = group[0];
      // Líneas distintas que conectan este tramo (ordenadas por nombre).
      const lines = Array.from(new Set(group.map((g) => g.shortName))).sort((a, b) => a.localeCompare(b, "es", { numeric: true }));

      const busSeconds = Math.max(60, best.toArrivalSeconds - best.fromArrivalSeconds);
      const busDistM = best.numStops * 350;
      // Espera al PRIMER bus de CUALQUIERA de las líneas del tramo (min entre todas).
      const waitS = cachedWait(f.stop.stopId, lines);
      const totalSeconds = f.walkS + waitS + busSeconds + toNear.walkS;

      const busPolyline = cachedPolyline(best.fromVariantId, best.fromSeq, best.toSeq);
      const r: Omit<PlannedRoute, "signature"> = {
        totalSeconds,
        totalWalkM: f.walkM + toNear.walkM,
        numTransfers: 0,
        legs: [
          {
            type: "walk",
            durationS: f.walkS,
            distanceM: Math.round(f.walkM),
            toStopId: f.stop.stopId,
            toStopName: f.stop.stopName,
            polyline: [[origin.lat, origin.lon], [f.stop.stopLat, f.stop.stopLon]],
          },
          {
            type: "bus",
            fromStopId: f.stop.stopId,
            fromStopName: f.stop.stopName,
            toStopId: toStopId,
            toStopName: toNear.stop.stopName,
            lines, // TODAS las líneas del tramo
            headsign: best.headsign,
            numStops: best.numStops,
            durationS: busSeconds + waitS,
            distanceM: busDistM,
            variantId: best.fromVariantId,
            polyline: busPolyline,
          },
          {
            type: "walk",
            durationS: toNear.walkS,
            distanceM: Math.round(toNear.walkM),
            fromStopId: toStopId,
            fromStopName: toNear.stop.stopName,
            polyline: [[toNear.stop.stopLat, toNear.stop.stopLon], [destination.lat, destination.lon]],
          },
        ],
      };
      candidates.push({ ...r, signature: buildSignature(r) });
    }
  }

  // ─── CON 1 TRANSBORDO ───
  // Solo buscamos si hay POCAS líneas directas distintas (≤2). Si hay muchas opciones
  // directas no tiene sentido proponer transbordos (siempre más lentos).
  const directLinesCount = new Set(
    candidates.filter((c) => c.numTransfers === 0 && c.legs.some((l) => l.type === "bus"))
      .map((c) => c.signature)
  ).size;

  if (maxTransfers >= 1 && directLinesCount < 3) {
    let transfersFound = 0;
    // Indexamos paradas por cuadrícula 0.005° (~500m) para buscar vecinas rápido.
    // Sin esto, anidar findStopsNear dentro del loop es O(N²) sobre ~5000 paradas.
    const stopGrid = getStopGridCached(allStopsById);

    // Presupuesto de evaluaciones de transbordo (cada una puede pegar a la DB vía
    // cachedDirects). Los mejores transbordos aparecen temprano (paradas de bajada
    // que acercan al destino); la cola larga de paradas lejanas solo mata el p95.
    let transferBudget = 1200;
    const linesSeenTransfer = new Set<string>();
    outer: for (const f of fromStops.slice(0, 6)) {
      const variantsAtFrom = getAllVariantsAtStop(f.stop.stopId);
      linesSeenTransfer.clear();
      for (const v1 of variantsAtFrom) {
        if (!allowVariant(v1.variantId)) continue; // no metro en viaje intra-MVD
        if (!isLineOperating(v1.shortName)) continue;
        // Una variante por línea en esta parada: otras variantes de la misma línea
        // raramente abren transbordos nuevos y multiplican el costo.
        if (linesSeenTransfer.has(v1.shortName)) continue;
        linesSeenTransfer.add(v1.shortName);
        // Espera del bus 1: depende solo de (parada origen + línea v1), constante para
        // todo este v1. Se calcula UNA vez acá (no en el loop interno) → mucho menos
        // consultas a schedule.db.
        const wait1S = cachedWait(f.stop.stopId, [v1.shortName]);
        const v1Downstream = getDownstreamStops(v1.variantId, v1.sequence);
        for (const alightStop of v1Downstream) {
          if (transferBudget <= 0) break outer;
          const alightStopRecord = allStopsById.get(alightStop.stopId);
          if (!alightStopRecord) continue;

          const distOrig = haversineM(origin.lat, origin.lon, alightStopRecord.stopLat, alightStopRecord.stopLon);
          const distDest = haversineM(destination.lat, destination.lon, alightStopRecord.stopLat, alightStopRecord.stopLon);
          if (distOrig < 500) continue;
          if (distDest < 500) continue;
          // PROGRESO: bajarse para transbordar solo tiene sentido si esa parada nos
          // ACERCA al destino respecto al origen. Bajarse más lejos del destino que el
          // origen es ir para el lado contrario → no es un transbordo útil. Esto recorta
          // drásticamente el peor caso cross-city (paradas downstream que se alejan) sin
          // perder rutas válidas. Margen de 1.05 para no descartar bordes razonables.
          if (distDest > directDistM * 1.05 && distDest > distOrig) continue;
          transferBudget--;

          // Paradas donde se puede tomar el bus 2 sin alejarse: la misma parada
          // de bajada (walkM=0) + vecinas a ≤MAX_TRANSFER_WALK_M (caminata corta).
          // Esto resuelve el caso "bajate del 187 acá, caminá 200m y tomate el 64".
          const boardCandidates: Array<{ stopId: string; walkM: number; stopRecord: StopRecord }> = [
            { stopId: alightStop.stopId, walkM: 0, stopRecord: alightStopRecord },
          ];
          for (const near of nearbyStopsFromGrid(stopGrid, alightStopRecord, MAX_TRANSFER_WALK_M)) {
            if (near.stop.stopId === alightStop.stopId) continue;
            boardCandidates.push({ stopId: near.stop.stopId, walkM: near.distM, stopRecord: near.stop });
          }

          for (const board of boardCandidates) {
            const directsFromBoard = cachedDirects(board.stopId);
            for (const m2 of directsFromBoard) {
              if (m2.fromVariantId === v1.variantId) continue;
              // Misma línea (183→183) se omite acá: la continuación honesta por
              // truncación de variantes se hará en un paso dedicado y acotado
              // (ver docs/ARQUITECTURA.md (§7)) para no explotar la búsqueda.
              if (v1.shortName === m2.shortName) continue;
              if (!isLineOperating(m2.shortName)) continue;
              const toNear = toStopById.get(m2.toStopId);
              if (!toNear) continue;

              const bus1Seconds = Math.max(60, alightStop.arrivalSeconds - v1.arrivalSeconds);
              const bus2Seconds = Math.max(60, m2.toArrivalSeconds - m2.fromArrivalSeconds);
              const transferWalkS = Math.round(board.walkM / WALK_SPEED_MS);
              const totalSeconds =
                f.walkS + wait1S + bus1Seconds +
                transferWalkS + TRANSFER_WAIT_S +
                bus2Seconds + toNear.walkS;

              const bus1Polyline = cachedPolyline(v1.variantId, v1.sequence, alightStop.sequence);
              const bus2Polyline = cachedPolyline(m2.fromVariantId, m2.fromSeq, m2.toSeq);
              const legs: RouteLeg[] = [
                {
                  type: "walk",
                  durationS: f.walkS,
                  distanceM: Math.round(f.walkM),
                  toStopId: f.stop.stopId,
                  toStopName: f.stop.stopName,
                  polyline: [[origin.lat, origin.lon], [f.stop.stopLat, f.stop.stopLon]],
                },
                {
                  type: "bus",
                  fromStopId: f.stop.stopId,
                  fromStopName: f.stop.stopName,
                  toStopId: alightStop.stopId,
                  toStopName: alightStopRecord.stopName,
                  lines: [v1.shortName],
                  headsign: v1.headsign,
                  numStops: alightStop.sequence - v1.sequence,
                  durationS: bus1Seconds + wait1S,
                  distanceM: (alightStop.sequence - v1.sequence) * 350,
                  variantId: v1.variantId,
                  polyline: bus1Polyline,
                },
              ];
              // Tramo de caminata entre paradas (solo si efectivamente caminamos)
              if (board.walkM > 0) {
                legs.push({
                  type: "walk",
                  durationS: transferWalkS,
                  distanceM: Math.round(board.walkM),
                  fromStopId: alightStop.stopId,
                  fromStopName: alightStopRecord.stopName,
                  toStopId: board.stopId,
                  toStopName: board.stopRecord.stopName,
                  polyline: [
                    [alightStopRecord.stopLat, alightStopRecord.stopLon],
                    [board.stopRecord.stopLat, board.stopRecord.stopLon],
                  ],
                });
              }
              legs.push(
                {
                  type: "bus",
                  fromStopId: board.stopId,
                  fromStopName: board.stopRecord.stopName,
                  toStopId: m2.toStopId,
                  toStopName: toNear.stop.stopName,
                  lines: [m2.shortName],
                  headsign: m2.headsign,
                  numStops: m2.numStops,
                  durationS: bus2Seconds + TRANSFER_WAIT_S,
                  distanceM: m2.numStops * 350,
                  variantId: m2.fromVariantId,
                  polyline: bus2Polyline,
                },
                {
                  type: "walk",
                  durationS: toNear.walkS,
                  distanceM: Math.round(toNear.walkM),
                  fromStopId: m2.toStopId,
                  fromStopName: toNear.stop.stopName,
                  polyline: [[toNear.stop.stopLat, toNear.stop.stopLon], [destination.lat, destination.lon]],
                },
              );
              const r: Omit<PlannedRoute, "signature"> = {
                totalSeconds,
                totalWalkM: f.walkM + board.walkM + toNear.walkM,
                numTransfers: 1,
                legs,
              };
              candidates.push({ ...r, signature: buildSignature(r) });
              transfersFound++;
              if (transfersFound > 60) break outer;
            }
          }
        }
      }
    }
  }

  // ─── CONTINUACIÓN MISMA-LÍNEA (181/183) — paso D, honesto y ACOTADO ───
  // Caso real: el GTFS oficial TRUNCA variantes. Un 183 "Pocitos" corta en Bv Gral
  // Artigas; otra variante 183 sigue desde ahí. Para el pasajero es "seguís en un 183
  // desde la misma parada" (mismo coche o el próximo de la línea) — NO un transbordo a
  // otra línea, y NO podemos jurar que es el mismo coche físico (el GTFS no da blocks).
  // Lo ofrecemos SOLO si no hay ninguna directa con bus (si la hay, esto sobra), y muy
  // acotado para no explotar la búsqueda (ver docs/ARQUITECTURA.md (§7)).
  const hasDirectBus = candidates.some(
    (c) => c.numTransfers === 0 && c.legs.some((l) => l.type === "bus")
  );
  if (maxTransfers >= 1 && !hasDirectBus) {
    let contFound = 0;
    // Presupuesto de consultas de "directas desde handoff": es la parte cara (puede
    // pegar a la DB). La truncación que buscamos está al FINAL del recorrido, así que
    // mirar muchas paradas downstream no aporta y mata el p95. Acotamos duro.
    let directsBudget = 60;
    const linesSeenAtFrom = new Set<string>();
    outerCont: for (const f of fromStops.slice(0, 4)) {
      const variantsAtFrom = getAllVariantsAtStop(f.stop.stopId);
      linesSeenAtFrom.clear();
      for (const v1 of variantsAtFrom) {
        if (!allowVariant(v1.variantId)) continue; // no metro en viaje intra-MVD
        if (!isLineOperating(v1.shortName)) continue;
        // Una sola variante por línea en esta parada: otras variantes de la misma línea
        // no abren continuaciones nuevas relevantes y multiplican el costo.
        if (linesSeenAtFrom.has(v1.shortName)) continue;
        linesSeenAtFrom.add(v1.shortName);
        const wait1S = cachedWait(f.stop.stopId, [v1.shortName]);
        // La truncación está cerca del final del recorrido → solo las últimas paradas.
        const v1Downstream = getDownstreamStops(v1.variantId, v1.sequence).slice(-6);
        for (const handoff of v1Downstream) {
          if (directsBudget <= 0) break outerCont;
          // El transbordo es EN SITIO (misma parada física): "te quedás ahí esperando
          // el próximo 183". Sin caminata → es lo que el pasajero entiende como "sigue".
          const handoffRecord = allStopsById.get(handoff.stopId);
          if (!handoffRecord) continue;
          if (haversineM(origin.lat, origin.lon, handoffRecord.stopLat, handoffRecord.stopLon) < 500) continue;

          // v2 = OTRA variante de la MISMA línea que desde acá llega cerca del destino.
          directsBudget--;
          const directsHere = cachedDirects(handoff.stopId);
          const m2 = directsHere.find(
            (m) =>
              m.shortName === v1.shortName &&            // misma línea
              m.fromVariantId !== v1.variantId &&        // distinta variante
              toStopById.has(m.toStopId)                 // llega cerca del destino
          );
          if (!m2) continue;
          const toNear = toStopById.get(m2.toStopId)!;

          const bus1Seconds = Math.max(60, handoff.arrivalSeconds - v1.arrivalSeconds);
          const bus2Seconds = Math.max(60, m2.toArrivalSeconds - m2.fromArrivalSeconds);
          const totalSeconds =
            f.walkS + wait1S + bus1Seconds +
            TRANSFER_WAIT_S + bus2Seconds + toNear.walkS;

          const legs: RouteLeg[] = [
            {
              type: "walk", durationS: f.walkS, distanceM: Math.round(f.walkM),
              toStopId: f.stop.stopId, toStopName: f.stop.stopName,
              polyline: [[origin.lat, origin.lon], [f.stop.stopLat, f.stop.stopLon]],
            },
            {
              type: "bus", fromStopId: f.stop.stopId, fromStopName: f.stop.stopName,
              toStopId: handoff.stopId, toStopName: handoffRecord.stopName,
              lines: [v1.shortName], headsign: v1.headsign,
              numStops: handoff.sequence - v1.sequence,
              durationS: bus1Seconds + wait1S, distanceM: (handoff.sequence - v1.sequence) * 350,
              variantId: v1.variantId,
              polyline: cachedPolyline(v1.variantId, v1.sequence, handoff.sequence),
            },
            {
              type: "bus", fromStopId: handoff.stopId, fromStopName: handoffRecord.stopName,
              toStopId: m2.toStopId, toStopName: toNear.stop.stopName,
              lines: [m2.shortName], headsign: m2.headsign, numStops: m2.numStops,
              durationS: bus2Seconds + TRANSFER_WAIT_S, distanceM: m2.numStops * 350,
              variantId: m2.fromVariantId,
              polyline: cachedPolyline(m2.fromVariantId, m2.fromSeq, m2.toSeq),
            },
            {
              type: "walk", durationS: toNear.walkS, distanceM: Math.round(toNear.walkM),
              fromStopId: m2.toStopId, fromStopName: toNear.stop.stopName,
              polyline: [[toNear.stop.stopLat, toNear.stop.stopLon], [destination.lat, destination.lon]],
            },
          ];
          const r: Omit<PlannedRoute, "signature"> = {
            totalSeconds,
            totalWalkM: f.walkM + toNear.walkM,
            numTransfers: 1,
            legs,
            sameLineContinuation: true,
          };
          candidates.push({ ...r, signature: buildSignature(r) });
          contFound++;
          if (contFound >= 3) break outerCont; // acotado: con 1-3 alcanza, no explotamos
        }
      }
    }
  }

  // ─── ANOTAR BUS LEGS con metadata de horario (closingSoon, endOfServiceMin) ───
  for (const c of candidates) {
    c.legs = c.legs.map(annotateBusLeg);
  }

  // ─── DEDUPE INTELIGENTE: mejor opción por signature, con conteo de alternativas ───
  candidates.sort((a, b) => a.totalSeconds - b.totalSeconds);
  const bySig = new Map<string, PlannedRoute>();
  const countBySig = new Map<string, number>();
  for (const c of candidates) {
    countBySig.set(c.signature, (countBySig.get(c.signature) ?? 0) + 1);
    const ex = bySig.get(c.signature);
    if (!ex || c.totalSeconds < ex.totalSeconds) bySig.set(c.signature, c);
  }
  for (const [sig, route] of bySig) {
    const altCount = (countBySig.get(sig) ?? 1) - 1;
    if (altCount > 0) route.alternatives = altCount;
  }

  // ─── FILTRO DE DOMINANCIA ───
  // Si tenemos al menos un directo, descartar transbordos que sean
  // sustancialmente peores: >1.5× el tiempo del mejor directo. Los transbordos
  // tienen sentido para abrir alternativas, no para mostrar siempre la peor opción.
  const bestDirect = Array.from(bySig.values())
    .filter((r) => r.numTransfers === 0 && r.signature !== "walk")
    .reduce<PlannedRoute | null>((best, r) => (!best || r.totalSeconds < best.totalSeconds ? r : best), null);
  if (bestDirect) {
    const cap = bestDirect.totalSeconds * 1.5;
    for (const [sig, route] of Array.from(bySig.entries())) {
      if (route.numTransfers >= 1 && route.totalSeconds > cap) {
        bySig.delete(sig);
      }
    }
  }

  // Ordenar resultados deduplicados por tiempo
  const deduped = Array.from(bySig.values()).sort((a, b) => a.totalSeconds - b.totalSeconds);

  // GARANTIZAR que "walk" aparezca si existe — aunque sea más lento que el bus,
  // es una opción válida para el usuario (sin esperar, ejercicio, etc.)
  const walk = deduped.find((r) => r.signature === "walk");
  const nonWalk = deduped.filter((r) => r.signature !== "walk");
  const topNonWalk = nonWalk.slice(0, walk ? maxResults - 1 : maxResults);

  if (!walk) return topNonWalk;

  // Insertar walk en posición lógica:
  //  - Si es más rápido que la mejor opción con bus → primero
  //  - Si es comparable (≤20% más lento) → segundo
  //  - Sino → al final como alternativa
  const fastestBus = topNonWalk[0]?.totalSeconds ?? Infinity;
  let walkPosition = topNonWalk.length;
  if (walk.totalSeconds <= fastestBus) walkPosition = 0;
  else if (walk.totalSeconds <= fastestBus * 1.2) walkPosition = 1;

  const result = [...topNonWalk];
  result.splice(walkPosition, 0, walk);
  return result.slice(0, maxResults);
}

/** Un punto del viaje con nombre opcional (para el rótulo del waypoint). */
export interface WaypointPoint { lat: number; lon: number; name?: string }

/**
 * Planifica una ruta encadenada que PASA por paradas intermedias (waypoints).
 * Resuelve cada tramo (O→W1, W1→W2, …, Wn→D) con el motor normal, toma la MEJOR
 * opción de cada tramo y las concatena en UNA ruta. La hora de salida de cada
 * tramo se corre con el tiempo acumulado del tramo anterior (schedule-aware real).
 *
 * Honesto: si algún tramo no tiene ruta, devolvemos [] (no inventamos un encadenado
 * a medias). Devuelve a lo sumo 1 ruta (la concatenación de los mejores tramos).
 */
export function planRoutesWithWaypoints(
  origin: WaypointPoint,
  waypoints: WaypointPoint[],
  destination: WaypointPoint,
  options: PlanOptions = {}
): PlannedRoute[] {
  const points = [origin, ...waypoints, destination];
  if (points.length < 3) {
    // Sin intermedias: es una ruta normal.
    return planRoutesGtfs(origin, destination, options);
  }

  const baseDepart = options.departAt ?? options.now ?? new Date();
  let cursor = new Date(baseDepart.getTime());

  const allLegs: RouteLeg[] = [];
  let totalSeconds = 0;
  let totalWalkM = 0;
  let numTransfers = 0;

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    // Cada tramo se planifica con hora de salida = llegada acumulada al waypoint.
    const legRoutes = planRoutesGtfs(a, b, { ...options, departAt: cursor, maxResults: 1 });
    const best = legRoutes[0];
    if (!best) return []; // un tramo sin ruta → no hay encadenado honesto

    allLegs.push(...best.legs);
    totalSeconds += best.totalSeconds;
    totalWalkM += best.totalWalkM;
    numTransfers += best.numTransfers;
    // Avanzar el reloj al final de este tramo (suma una pequeña pausa si es waypoint
    // intermedio — el usuario hace algo ahí; no lo inventamos como 0).
    cursor = new Date(cursor.getTime() + best.totalSeconds * 1000);
  }

  // numTransfers acá cuenta los transbordos REALES dentro de los tramos; cada cambio
  // de tramo en un waypoint es una parada deliberada, no un transbordo forzado.
  const route: PlannedRoute = {
    totalSeconds,
    totalWalkM,
    numTransfers,
    legs: allLegs,
    signature: `via:${waypoints.map((w) => w.name ?? `${w.lat.toFixed(3)},${w.lon.toFixed(3)}`).join("+")}`,
    viaWaypoints: waypoints.map((w, i) => w.name ?? `Parada ${i + 1}`),
  };
  return [route];
}
