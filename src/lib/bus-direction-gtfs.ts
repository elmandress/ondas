/**
 * Filtro upstream basado en GTFS oficial (no heurística).
 * SRS FR-2.7 (NUEVO mayo 2026 - sesión 3).
 *
 * Algoritmo (cómo lo hacen Transit, Citymapper, Cómo Ir oficial):
 *
 *   1. Identificar la VARIANTE del bus (línea + destino → trip_id GTFS)
 *   2. Verificar que la PARADA TARGET está en el recorrido de esa variante
 *      → si no está: bus va por otra ruta, DESCARTAR
 *   3. Calcular la "posición actual" del bus = parada más cercana del recorrido
 *      a la posición GPS del bus
 *   4. Si current_seq >= target_seq: bus YA PASÓ, DESCARTAR
 *   5. Si current_seq < target_seq: bus va HACIA la parada
 *      - "paradas restantes" = target_seq - current_seq
 *      - ETA estimada = paradas_restantes * tiempo_promedio_por_parada (~60s urbano)
 *
 * Esto resuelve los bugs reportados:
 * - "329 yendo a la otra parada" → variante incorrecta, se descarta
 * - "187 en la Loma del orto a 10min" → si está antes de la parada en
 *   el trip, ETA real (no haversine), si no está en el trip, descartado
 * - "tracking inconsistente" → ahora es determinístico
 */

import type { VehiclePosition } from "@/lib/stm";
import {
  getVariantsForLine,
  getStopSequence,
  getStopsForVariant,
  normalizeHeadsign,
  type VariantCandidate,
} from "@/lib/gtfs-db";
import { findStopServer } from "@/lib/stops-server";

/** Tiempo promedio entre paradas en tráfico urbano de MVD (segundos). */
const AVG_SECONDS_PER_STOP = 70;

/**
 * Distancia máxima entre el GPS del bus y la parada GTFS más cercana para
 * considerar el posicionamiento válido. 900m tolera GPS ruidoso urbano y
 * buses entre paradas sin señal (puentes, túneles, giros largos).
 */
const MAX_GPS_SNAP_M = 900;

export interface GtfsCheckResult {
  /** true si el bus va hacia la parada (upstream). */
  goingTo: boolean;
  /** Razón del descarte cuando !goingTo. */
  reason?: "no-line" | "no-variant" | "stop-not-in-route" | "passed" | "no-position";
  /** stop_sequence del bus en su recorrido actual (parada más cercana proyectada). */
  currentSequence?: number;
  /** stop_sequence de la parada target. */
  targetSequence?: number;
  /** Cuántas paradas faltan para llegar (incluyendo la target). */
  remainingStops?: number;
  /** ETA estimada en segundos basada en paradas restantes. */
  etaSeconds?: number;
  /** Distancia REAL del bus a la parada SIGUIENDO el recorrido (suma haversine entre paradas). */
  routeDistanceM?: number;
  /** Headsign del trip GTFS matcheado (para debug y visualización). */
  matchedHeadsign?: string;
}

interface StopCoord {
  stopId: string;
  lat: number;
  lon: number;
}

/** Cache simple en memoria para coords de paradas (server-side). */
const stopCoordCache = new Map<string, StopCoord | null>();
function getStopCoord(stopId: string): StopCoord | null {
  if (stopCoordCache.has(stopId)) return stopCoordCache.get(stopId)!;
  const s = findStopServer(stopId);
  const coord = s ? { stopId: s.stopId, lat: s.stopLat, lon: s.stopLon } : null;
  stopCoordCache.set(stopId, coord);
  return coord;
}

/** Distancia plana entre dos puntos en metros (suficiente para distancias urbanas). */
function distM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dx = (lon2 - lon1) * 111320 * Math.cos((lat1 * Math.PI) / 180);
  const dy = (lat2 - lat1) * 111320;
  return Math.hypot(dx, dy);
}

/** ¿El destino del bus coincide con alguno de los headsigns del patrón? */
function headsignMatches(candidate: VariantCandidate, normDest: string): boolean {
  if (!normDest) return false;
  const all = [candidate.headsign, ...candidate.allHeadsigns.split("|")];
  for (const h of all) {
    const n = normalizeHeadsign(h);
    if (!n) continue;
    if (n === normDest || n.includes(normDest) || normDest.includes(n)) return true;
  }
  return false;
}

/** Resultado de evaluar un recorrido candidato contra la posición GPS del bus. */
interface CandidateEval {
  variant: VariantCandidate;
  currentSeq: number;
  targetSeq: number;
  snapDist: number;
  bestStopIdx: number;
  stops: ReturnType<typeof getStopsForVariant>;
}

/**
 * Proyecta el GPS del bus sobre un recorrido y verifica que va hacia la parada.
 * Devuelve null si: la parada no está en el recorrido, el bus ya pasó, o el
 * GPS no snapea (fuera de ruta).
 */
/** Resultado discriminado: ok (va hacia) o el motivo preciso del descarte. */
type EvalResult =
  | { ok: CandidateEval }
  | { fail: "no-stop" | "no-snap" | "passed" };

function evalCandidate(
  variant: VariantCandidate,
  bus: { lat: number; lon: number },
  targetStopId: string
): EvalResult {
  const targetSeq = getStopSequence(variant.variantId, targetStopId);
  if (targetSeq == null) return { fail: "no-stop" }; // este recorrido no pasa por la parada

  const stops = getStopsForVariant(variant.variantId);
  if (stops.length === 0) return { fail: "no-stop" };

  let bestStopIdx = -1;
  let snapDist = Infinity;
  for (let i = 0; i < stops.length; i++) {
    const coord = getStopCoord(stops[i].stopId);
    if (!coord) continue;
    const d = distM(bus.lat, bus.lon, coord.lat, coord.lon);
    if (d < snapDist) { snapDist = d; bestStopIdx = i; }
  }
  if (bestStopIdx === -1 || snapDist > MAX_GPS_SNAP_M) return { fail: "no-snap" };

  const currentSeq = stops[bestStopIdx].sequence;
  // Estrictamente PASADO (>). Si snapeó a la parada misma (==), está LLEGANDO, no pasó.
  if (currentSeq > targetSeq) return { fail: "passed" };

  return { ok: { variant, currentSeq, targetSeq, snapDist, bestStopIdx, stops } };
}

/**
 * Determina si un bus en vivo va hacia una parada específica, usando GTFS.
 *
 * Desde la reconstrucción de gtfs.db (mayo 2026), cada línea tiene varios
 * recorridos distintos (la 76 tiene 9). Para saber por CUÁL va el bus:
 *   1. Candidatos = recorridos de la línea cuyo headsign matchea el destino
 *      del bus (si ninguno matchea, se prueban todos).
 *   2. Cada candidato que PASA por la parada se evalúa proyectando el GPS.
 *   3. Se elige el que mejor ajusta al GPS (menor distancia de snap) — ese es
 *      el recorrido físico que el bus está siguiendo realmente.
 *
 * Esto arregla de raíz:
 *   - "76 por la calle paralela": se elige el recorrido cuyas paradas siguen
 *     la posición real del bus, no uno colapsado.
 *   - Buses-fantasma: un "PORTONES SHOPPING" corto NO contiene paradas más
 *     allá del shopping → si la parada target está después, ese candidato se
 *     descarta y el bus no se muestra (correcto, no va a llegar).
 */
export function busTowardsStopGtfs(
  bus: VehiclePosition & { destinoDesc?: string },
  targetStopId: string
): GtfsCheckResult {
  const variants = getVariantsForLine(bus.lineName);
  if (variants.length === 0) {
    return { goingTo: false, reason: "no-line" };
  }

  // 1. Priorizar recorridos cuyo headsign matchea el destino reportado por el bus.
  const normDest = normalizeHeadsign(bus.destinoDesc || "");
  const matched = variants.filter((v) => headsignMatches(v, normDest));
  const candidates = matched.length > 0 ? matched : variants;

  // 2. Evaluar cada candidato; quedarse con los que van hacia la parada.
  //    Distinguimos motivos con PRECISIÓN para poder descartar solo lo confiado:
  //    - "passed": el bus snapeó a una variante que incluye la parada y quedó ATRÁS.
  //    - "no-position": la parada está en alguna variante pero el GPS no snapeó (lejos/entre
  //      paradas) → incierto, NO lo tratamos como pasado.
  const evals: CandidateEval[] = [];
  let sawStop = false;   // la parada está en alguna variante candidata
  let sawPassed = false; // snapeó y quedó atrás en alguna
  for (const v of candidates) {
    const r = evalCandidate(v, bus, targetStopId);
    if ("ok" in r) { evals.push(r.ok); sawStop = true; }
    else if (r.fail !== "no-stop") {
      sawStop = true;
      if (r.fail === "passed") sawPassed = true;
    }
  }

  if (evals.length === 0) {
    const reason = !sawStop ? "stop-not-in-route" : sawPassed ? "passed" : "no-position";
    return { goingTo: false, reason, matchedHeadsign: candidates[0]?.headsign };
  }

  // 3. Elegir el recorrido que mejor ajusta al GPS real del bus.
  evals.sort((a, b) => a.snapDist - b.snapDist);
  const best = evals[0];
  const { stops, bestStopIdx, currentSeq, targetSeq, variant } = best;

  const remainingStops = targetSeq - currentSeq;

  // ETA por horario GTFS del recorrido; fallback a promedio si falta el dato.
  const arrCurrent = stops[bestStopIdx].arrivalSeconds;
  const targetStopRow = stops.find((s) => s.sequence === targetSeq);
  const arrTarget = targetStopRow?.arrivalSeconds || 0;
  let etaSeconds: number;
  if (arrTarget > arrCurrent && arrCurrent > 0) {
    etaSeconds = arrTarget - arrCurrent;
  } else {
    etaSeconds = remainingStops * AVG_SECONDS_PER_STOP;
  }

  // Distancia REAL siguiendo el recorrido (suma haversine entre paradas).
  let routeDistanceM = 0;
  let prev: StopCoord | null = getStopCoord(stops[bestStopIdx].stopId);
  for (let i = bestStopIdx + 1; i <= stops.length - 1 && stops[i].sequence <= targetSeq; i++) {
    const c = getStopCoord(stops[i].stopId);
    if (prev && c) routeDistanceM += distM(prev.lat, prev.lon, c.lat, c.lon);
    if (c) prev = c;
    if (stops[i].sequence === targetSeq) break;
  }

  return {
    goingTo: true,
    matchedHeadsign: variant.headsign,
    currentSequence: currentSeq,
    targetSequence: targetSeq,
    remainingStops,
    etaSeconds,
    routeDistanceM: Math.round(routeDistanceM),
  };
}

/**
 * Chequeo de RESPALDO honesto: ¿el bus probablemente YA PASÓ la parada?
 *
 * `busTowardsStopGtfs` exige que el GPS snapee a ≤900m de una parada de la variante.
 * Pero un bus que ya pasó y va entre paradas lejos (o por una calle paralela) cae en
 * "no-position", y como confiamos en el STM (trustUpstream) se mostraba igual → bug
 * del usuario: "estoy en la 160, el bus está en la 162 y me dice que llega".
 *
 * Esta función NO usa el límite de snap: toma la mejor variante de la línea (por
 * headsign), encuentra la parada MÁS CERCANA al bus sea cual sea la distancia, y si su
 * secuencia es mayor que la de la parada objetivo → el bus ya la dejó atrás. Margen de
 * 1 parada para no descartar al que está justo llegando (== o target-1).
 *
 * Devuelve true SOLO si está razonablemente seguro de que pasó; ante la duda, false
 * (preferimos mostrar de más que ocultar un bus que sí viene).
 */
export function busLikelyPassedStop(
  bus: { lat: number; lon: number; lineName: string; destinoDesc?: string },
  targetStopId: string
): boolean {
  const variants = getVariantsForLine(bus.lineName);
  if (variants.length === 0) return false;

  const normDest = normalizeHeadsign(bus.destinoDesc || "");
  const matched = variants.filter((v) => headsignMatches(v, normDest));
  const candidates = matched.length > 0 ? matched : variants;

  // De las variantes que pasan por la parada, elegir la que mejor ajusta al GPS
  // (parada más cercana al bus). Comparar su secuencia con la del objetivo.
  let bestSnap = Infinity;
  let passedOnBest = false;
  let evaluatedAny = false;
  for (const v of candidates) {
    const targetSeq = getStopSequence(v.variantId, targetStopId);
    if (targetSeq == null) continue; // esta variante no pasa por la parada
    const stops = getStopsForVariant(v.variantId);
    if (stops.length === 0) continue;
    let curIdx = -1, curSnap = Infinity;
    for (let i = 0; i < stops.length; i++) {
      const c = getStopCoord(stops[i].stopId);
      if (!c) continue;
      const d = distM(bus.lat, bus.lon, c.lat, c.lon);
      if (d < curSnap) { curSnap = d; curIdx = i; }
    }
    if (curIdx === -1) continue;
    evaluatedAny = true;
    if (curSnap < bestSnap) {
      bestSnap = curSnap;
      // Pasó si la parada más cercana al bus está MÁS DE 1 después de la objetivo.
      passedOnBest = stops[curIdx].sequence > targetSeq + 1;
    }
  }
  // Solo afirmamos "pasó" si pudimos ubicar el bus en una variante con la parada y la
  // mejor proyección está a una distancia plausible (≤1.5km; más lejos = no confiable).
  return evaluatedAny && passedOnBest && bestSnap <= 1500;
}

/** Filtra una lista de buses para quedarse solo con los que van hacia `stopId`. */
export function filterBusesGoingToStop<T extends VehiclePosition & { destinoDesc?: string }>(
  buses: T[],
  stopId: string
): Array<T & { _gtfs: GtfsCheckResult }> {
  const result: Array<T & { _gtfs: GtfsCheckResult }> = [];
  for (const b of buses) {
    const check = busTowardsStopGtfs(b, stopId);
    if (check.goingTo) {
      result.push({ ...b, _gtfs: check });
    }
  }
  return result;
}
