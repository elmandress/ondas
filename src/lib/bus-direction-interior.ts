/**
 * Segundo motor de honestidad — espejo conceptual de `bus-direction-gtfs.ts`, pero para
 * el INTERIOR (Busmatick). Montevideo tiene GTFS oficial → proyección geométrica sobre la
 * polilínea del recorrido. El interior NO tiene GTFS ni horario: lo único que hay es un
 * GRAFO de secuencia de paradas inferido de las observaciones del feed
 * (`interior-edges.json`, aristas "p1c>p2c"). Este módulo navega ese grafo.
 *
 * Diferencia clave que define todo lo demás: el grafo da ORDEN, no TIEMPO — el peso de
 * cada arista es un CONTEO de observaciones, no segundos. Por eso el ETA sale de
 * `hops × AVG_SECONDS_PER_HOP` (una constante puesta a ojo), un ESTIMADO, nunca con la
 * confianza del ETA geométrico de MVD. Todo minuto que sale de acá viaja con
 * `estimated: true` → la UI lo muestra con "~".
 *
 * `delayMin` (reg) del feed NO se usa para el ETA: es atraso vs un plan interno de
 * Busmatick que no tenemos (no hay horario del interior), así que no tiene baseline. Es
 * un número que se ve preciso pero no significa nada — falsa precisión. A lo sumo, nota
 * cualitativa ("atrasado"), nunca minutos-hasta-llegar.
 *
 * Tres capas de honestidad (espejo de `busLikelyPassedStop`: escondemos la AFIRMACIÓN de
 * llegada, nunca la existencia del bus):
 *   - approaching: el grafo encierra p1c→target dentro de los topes → "a N paradas · ~M min".
 *   - nearby: la línea sirve la parada + posición real cerca, pero el grafo no conecta
 *     (fragmento suelto / p1c desconocido) → "~M min" sin conteo de paradas.
 *   - in-zone: no podemos confirmar que va HACIA la parada → demovido a "circulando en la
 *     zona" (distancia, sin ETA).
 */

import { haversineMeters } from "@/lib/geo";

/** Aristas de un recorrido: { "from>to": conteo }. El conteo es frecuencia, NO tiempo. */
export type InteriorSubgraph = Record<string, number>;
/** Grafo completo del interior: { "zona|line|dir": subgrafo }. */
export type InteriorEdges = Record<string, InteriorSubgraph>;

/**
 * Estimación a ojo del tiempo entre paradas consecutivas en el interior (segundos).
 * SIN VALIDAR: el grafo no tiene tiempos, solo orden. Las paradas del interior están más
 * separadas que las de MVD (donde `AVG_SECONDS_PER_STOP = 70`). Se afina con `samples`
 * cuando juntemos suficientes muestras reales — documentar al calibrar. Hasta entonces,
 * todo ETA que use esta constante se muestra con "~" (estimado), nunca como dato firme.
 */
export const AVG_SECONDS_PER_HOP = 90;

/** Tope de saltos para afirmar "a N paradas": más allá, el grafo ralo deja de ser confiable. */
export const MAX_HOPS = 8;
/** Tope de minutos para mostrar como llegada con ETA (espejo del cap de tiempo real de MVD). */
export const MAX_ETA_MIN = 35;
/** Profundidad máxima del walk: corta ciclos de terminal y recorridas runaway en grafo ruidoso. */
const WALK_DEPTH_GUARD = 30;

/** Radio (m) para considerar un bus de la línea "cerca" de la parada (ETA aproximado defendible). */
const NEARBY_CLOSE_M = 1500;
/** Radio (m) para listar un bus como "circulando en la zona" (sin ETA, solo presencia). */
const NEARBY_AREA_M = 4000;
/** Sin líneas conocidas en la parada, solo un bus MUY cerca cuenta como "pasando". */
const UNKNOWN_LINES_NEAR_M = 1000;

/** Velocidad asumida (km/h) cuando el bus reporta parado/ruido — promedio urbano realista. */
const ASSUMED_SPEED_KMH = 25;

export type InteriorTier = "approaching" | "nearby" | "in-zone";

export interface InteriorClassifyInput {
  line: string;
  /** sen del feed — elige el subgrafo dirigido. */
  dir?: string;
  /** p1c — próxima parada del bus (entrada al grafo). */
  nextStopCode?: string;
  /** p2c — parada siguiente a la próxima (sanity de sentido; reservado). */
  nextNextStopCode?: string;
  lat: number;
  lon: number;
  /** km/h reportado por el feed. */
  speed?: number;
}

export interface InteriorTarget {
  zona: string;
  code: string;
  lat: number;
  lon: number;
  /** Líneas que sirven la parada (de interior-stops.json). */
  lines: string[];
}

export interface InteriorClassifyResult {
  tier: InteriorTier;
  /** Saltos hasta la parada — solo `approaching`. */
  hops?: number;
  /** ETA en minutos — `approaching` | `nearby`. SIEMPRE estimado (ver `estimated`). */
  etaMin?: number;
  /** Distancia en línea recta bus→parada (m) — todas las capas. */
  distM: number;
  /** true cuando `etaMin` viene de una constante sin validar → la UI lo muestra con "~". */
  estimated: boolean;
}

/** Adyacencia from→[to] de un subgrafo dirigido. */
function adjacency(sub: InteriorSubgraph): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const edge of Object.keys(sub)) {
    const i = edge.indexOf(">");
    if (i < 0) continue;
    const from = edge.slice(0, i);
    const to = edge.slice(i + 1);
    const list = adj.get(from);
    if (list) list.push(to);
    else adj.set(from, [to]);
  }
  return adj;
}

/**
 * Saltos mínimos de `from` a `target` siguiendo aristas dirigidas (BFS). El grafo del
 * interior es mayormente lineal, pero la inferencia mete fragmentos sueltos y, en las
 * terminales, ciclos; el BFS con `seen` y tope de profundidad los maneja sin colgarse.
 * Devuelve el nº de saltos, o `null` si `target` no es alcanzable desde `from`.
 */
export function hopsToStop(
  sub: InteriorSubgraph,
  from: string,
  target: string,
  maxDepth = WALK_DEPTH_GUARD,
): number | null {
  if (from === target) return 0;
  const adj = adjacency(sub);
  const seen = new Set<string>([from]);
  let frontier: string[] = [from];
  let depth = 0;
  while (frontier.length > 0 && depth < maxDepth) {
    const next: string[] = [];
    for (const node of frontier) {
      for (const nx of adj.get(node) || []) {
        if (nx === target) return depth + 1;
        if (!seen.has(nx)) {
          seen.add(nx);
          next.push(nx);
        }
      }
    }
    frontier = next;
    depth++;
  }
  return null;
}

/** ETA estimado a partir de saltos. SIEMPRE aproximado (la constante no está validada). */
export function etaMinFromHops(hops: number): number {
  return Math.max(0, Math.round((hops * AVG_SECONDS_PER_HOP) / 60));
}

/** ETA grueso por distancia en línea recta y velocidad asumida (cuando no hay grafo). */
function etaMinFromDistance(distM: number, speedKmh?: number): number {
  const kmh = speedKmh && speedKmh > 3 ? speedKmh : ASSUMED_SPEED_KMH;
  const speedMs = (kmh * 1000) / 3600;
  return Math.max(0, Math.round(distM / speedMs / 60));
}

function lineServesStop(busLine: string, stopLines: string[]): boolean {
  const l = busLine.trim();
  return stopLines.some((sl) => sl.trim() === l);
}

/**
 * Clasifica un bus en vivo del interior contra la parada que el usuario mira. Espejo de
 * `busTowardsStopGtfs`, pero en 3 capas honestas en vez de un booleano. Devuelve `null`
 * cuando el bus no aporta nada a esta parada (otra línea y/o fuera de la zona).
 */
export function classifyInteriorBus(
  bus: InteriorClassifyInput,
  target: InteriorTarget,
  edges: InteriorEdges,
): InteriorClassifyResult | null {
  const distM = haversineMeters(bus.lat, bus.lon, target.lat, target.lon);

  // 1. APPROACHING — exige dir (subgrafo dirigido) + p1c, y que el grafo encierre la
  //    cadena p1c→target dentro de los topes. Es el caso fuerte (orden conocido).
  if (bus.dir && bus.nextStopCode) {
    const sub = edges[`${target.zona}|${bus.line}|${bus.dir}`];
    if (sub) {
      const hops = hopsToStop(sub, bus.nextStopCode, target.code);
      if (hops !== null && hops <= MAX_HOPS) {
        const etaMin = etaMinFromHops(hops);
        if (etaMin <= MAX_ETA_MIN) {
          return { tier: "approaching", hops, etaMin, distM, estimated: true };
        }
      }
      // Alcanzable pero más allá de los topes (o sin dato): NO afirmamos conteo,
      // degradamos a las capas por proximidad de abajo.
    }
  }

  const knowLines = target.lines.length > 0;
  const serves = knowLines && lineServesStop(bus.line, target.lines);

  // 2. NEARBY — la línea sirve la parada y el bus está genuinamente cerca: posición real,
  //    ETA grueso por distancia (marcado estimado), sin conteo de paradas inventado.
  //    Sin líneas conocidas (parada nueva), solo un bus MUY cerca cuenta como "pasando".
  const nearbyHit = knowLines ? serves && distM <= NEARBY_CLOSE_M : distM <= UNKNOWN_LINES_NEAR_M;
  if (nearbyHit) {
    return { tier: "nearby", etaMin: etaMinFromDistance(distM, bus.speed), distM, estimated: true };
  }

  // 3. IN-ZONE — bus real de una línea de la parada, pero no podemos atarlo a ella:
  //    lo demovemos a "circulando en la zona" (distancia, sin afirmar ETA de llegada).
  if (serves && distM <= NEARBY_AREA_M) {
    return { tier: "in-zone", distM, estimated: true };
  }

  return null;
}
