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
import {
  getAllVariantsAtStop,
  getDownstreamStops,
  getStopsBetween,
} from "@/lib/gtfs-db";
import { getLineHoursLookup, type LineHoursLookup } from "@/lib/line-hours";

const WALK_SPEED_MS = 1.25;            // 4.5 km/h
const BUS_WAIT_DEFAULT_S = 360;        // 6 min promedio de espera por bus
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
}

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface NearStop { stop: StopRecord; walkM: number; walkS: number; }

/**
 * Construye polyline de un bus leg conectando las paradas del trip entre
 * fromSeq y toSeq (inclusivo) con sus coordenadas.
 *
 * No es la polyline exacta del shape GTFS (que pasa por las curvas de la calle),
 * pero conectar paradas con líneas rectas es visualmente suficiente para
 * mostrar el recorrido en el mapa (las paradas están cada 200-400m en MVD).
 */
function buildBusLegPolyline(
  variantId: string,
  fromSeq: number,
  toSeq: number,
  stopsById: Map<string, StopRecord>
): [number, number][] {
  const intermediates = getStopsBetween(variantId, fromSeq, toSeq);
  const coords: [number, number][] = [];
  for (const s of intermediates) {
    const stop = stopsById.get(s.stopId);
    if (stop) coords.push([stop.stopLat, stop.stopLon]);
  }
  return coords;
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

function buildStopGrid(stopsById: Map<string, StopRecord>, _radiusM: number): StopGrid {
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
  const busLines = route.legs
    .filter((l) => l.type === "bus")
    .map((l) => normalizeLineName(l.lines?.[0] || "?"))
    .sort();
  if (busLines.length === 1) return `direct:${busLines[0]}`;
  return `transfer:${busLines.join("+")}`;
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
  } = options;

  // Filtro de horario operativo: si now === null, no filtramos.
  // Si no se pasa, usamos new Date() para filtrar líneas que no operan ahora.
  const hoursLookup: LineHoursLookup | null = now === null ? null : getLineHoursLookup(now ?? new Date());
  const isLineOperating = (line: string): boolean => {
    if (!hoursLookup) return true;
    return hoursLookup.operatesNowOrSoon(line, operatingWindowMin);
  };

  const directDistM = haversineM(origin.lat, origin.lon, destination.lat, destination.lon);

  const fromStops = findStopsNear(origin, walkRadiusM, 15);
  const toStops = findStopsNear(destination, walkRadiusM, 15);

  const toStopIds = new Set(toStops.map((t) => t.stop.stopId));
  const toStopById = new Map(toStops.map((t) => [t.stop.stopId, t]));

  // Mapa de todas las paradas por id (para polylines)
  const allStopsById = new Map(getStopsServerSync().map((s) => [s.stopId, s]));

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
  for (const f of fromStops.slice(0, 10)) {
    const directs = findDirectVariants(f.stop.stopId, toStopIds);
    for (const m of directs) {
      const toNear = toStopById.get(m.toStopId);
      if (!toNear) continue;
      // Filtro horario: descartar líneas que NO operan ahora ni en próx. 90 min
      if (!isLineOperating(m.shortName)) continue;

      const busSeconds = Math.max(60, m.toArrivalSeconds - m.fromArrivalSeconds);
      const busDistM = m.numStops * 350;
      const totalSeconds = f.walkS + BUS_WAIT_DEFAULT_S + busSeconds + toNear.walkS;

      const busPolyline = buildBusLegPolyline(m.fromVariantId, m.fromSeq, m.toSeq, allStopsById);
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
            // walk inicial: del origen real a la parada
            polyline: [[origin.lat, origin.lon], [f.stop.stopLat, f.stop.stopLon]],
          },
          {
            type: "bus",
            fromStopId: f.stop.stopId,
            fromStopName: f.stop.stopName,
            toStopId: m.toStopId,
            toStopName: toNear.stop.stopName,
            lines: [m.shortName],
            headsign: m.headsign,
            numStops: m.numStops,
            durationS: busSeconds + BUS_WAIT_DEFAULT_S,
            distanceM: busDistM,
            variantId: m.fromVariantId,
            polyline: busPolyline,
          },
          {
            type: "walk",
            durationS: toNear.walkS,
            distanceM: Math.round(toNear.walkM),
            fromStopId: m.toStopId,
            fromStopName: toNear.stop.stopName,
            // walk final: de la parada al destino real
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
    const stopGrid = buildStopGrid(allStopsById, MAX_TRANSFER_WALK_M);

    outer: for (const f of fromStops.slice(0, 6)) {
      const variantsAtFrom = getAllVariantsAtStop(f.stop.stopId);
      for (const v1 of variantsAtFrom) {
        if (!isLineOperating(v1.shortName)) continue;
        const v1Downstream = getDownstreamStops(v1.variantId, v1.sequence);
        for (const alightStop of v1Downstream) {
          const alightStopRecord = allStopsById.get(alightStop.stopId);
          if (!alightStopRecord) continue;

          const distOrig = haversineM(origin.lat, origin.lon, alightStopRecord.stopLat, alightStopRecord.stopLon);
          const distDest = haversineM(destination.lat, destination.lon, alightStopRecord.stopLat, alightStopRecord.stopLon);
          if (distOrig < 500) continue;
          if (distDest < 500) continue;

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
            const directsFromBoard = findDirectVariants(board.stopId, toStopIds);
            for (const m2 of directsFromBoard) {
              if (m2.fromVariantId === v1.variantId) continue;
              if (v1.shortName === m2.shortName) continue;
              if (!isLineOperating(m2.shortName)) continue;
              const toNear = toStopById.get(m2.toStopId);
              if (!toNear) continue;

              const bus1Seconds = Math.max(60, alightStop.arrivalSeconds - v1.arrivalSeconds);
              const bus2Seconds = Math.max(60, m2.toArrivalSeconds - m2.fromArrivalSeconds);
              const transferWalkS = Math.round(board.walkM / WALK_SPEED_MS);
              const totalSeconds =
                f.walkS + BUS_WAIT_DEFAULT_S + bus1Seconds +
                transferWalkS + TRANSFER_WAIT_S +
                bus2Seconds + toNear.walkS;

              const bus1Polyline = buildBusLegPolyline(v1.variantId, v1.sequence, alightStop.sequence, allStopsById);
              const bus2Polyline = buildBusLegPolyline(m2.fromVariantId, m2.fromSeq, m2.toSeq, allStopsById);
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
                  durationS: bus1Seconds + BUS_WAIT_DEFAULT_S,
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
