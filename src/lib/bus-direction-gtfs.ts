/**
 * Filtro upstream basado en GTFS oficial (no heurística).
 * SRS FR-2.7 (NUEVO mayo 2026 - sesión 3). Reescrito en R57 (junio 2026).
 *
 * Algoritmo (cómo lo hacen Transit, Citymapper, Cómo Ir oficial):
 *
 *   1. Identificar la VARIANTE del bus (línea + destino → trip GTFS)
 *   2. Verificar que la PARADA TARGET está en el recorrido de esa variante
 *      → si no está: bus va por otra ruta, DESCARTAR
 *   3. PROYECTAR el GPS del bus sobre la polilínea de paradas del recorrido
 *      (segmento más cercano + fracción dentro de él, NO "parada más cercana")
 *   4. Si la posición proyectada quedó MÁS ALLÁ de la parada target (margen en
 *      metros por el recorrido): bus YA PASÓ, DESCARTAR
 *   5. Si no: bus va HACIA la parada
 *      - "paradas restantes" = cuántas paradas del recorrido quedan por delante
 *      - ETA por horario GTFS interpolado; fallback promedio por parada
 *      - distancia REAL = metros restantes siguiendo el recorrido
 *
 * Por qué proyección y no "parada más cercana" (bug R57): con el snap a la
 * parada más cercana, un bus que ACABABA de pasar la parada seguía snapeando a
 * ella (== target → "llegando") hasta estar a mitad de camino de la siguiente,
 * y el margen de ±1 parada del respaldo dejaba pasar buses hasta 2 paradas más
 * allá. Con la proyección, "ya pasó" se decide en METROS sobre el recorrido.
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
 * Distancia máxima entre el GPS del bus y el recorrido (proyectado) para
 * considerar el posicionamiento válido. 900m tolera GPS ruidoso urbano y
 * buses entre paradas sin señal (puentes, túneles, giros largos).
 */
const MAX_GPS_SNAP_M = 900;

/**
 * Margen "ya pasó" en metros POR EL RECORRIDO: si la proyección del bus quedó
 * más de esto después de la parada target, ya la dejó atrás. 75m ≈ el bus
 * acaba de arrancar de la parada / ruido GPS en la esquina; preferimos mostrar
 * de más un bus que está EN la parada que ocultar uno que viene llegando.
 */
const PASSED_ALONG_MARGIN_M = 75;

/**
 * Margen del chequeo de RESPALDO (busLikelyPassedStop, sin límite de snap):
 * más conservador porque el GPS no snapeó bien (calle paralela, lejos).
 */
const LIKELY_PASSED_MARGIN_M = 120;

export interface GtfsCheckResult {
  /** true si el bus va hacia la parada (upstream). */
  goingTo: boolean;
  /** Razón del descarte cuando !goingTo. */
  reason?: "no-line" | "no-variant" | "stop-not-in-route" | "passed" | "no-position";
  /** stop_sequence del bus en su recorrido actual (parada inmediatamente detrás). */
  currentSequence?: number;
  /** stop_sequence de la parada target. */
  targetSequence?: number;
  /** Cuántas paradas faltan para llegar (incluyendo la target). */
  remainingStops?: number;
  /** ETA estimada en segundos basada en horario GTFS interpolado o promedio. */
  etaSeconds?: number;
  /** Distancia REAL del bus a la parada SIGUIENDO el recorrido (metros). */
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

// ─────────────────────────────────────────────────────────────────────────────
// Polilínea del recorrido (paradas con coordenada, en orden) + proyección
// ─────────────────────────────────────────────────────────────────────────────

interface VariantPath {
  /** Paradas con coordenada conocida, en orden de recorrido. origIdx = índice en getStopsForVariant. */
  pts: Array<{ origIdx: number; lat: number; lon: number }>;
  /** Distancia acumulada (m) por el recorrido hasta cada punto de `pts`. */
  alongAt: number[];
  /** origIdx → índice en pts (para ubicar la parada target en el path). */
  pathIdxByOrig: Map<number, number>;
}

/** Cache por variante: el path no cambia durante la vida del proceso. */
const pathCache = new Map<string, VariantPath | null>();

function getVariantPath(variantId: string): VariantPath | null {
  if (pathCache.has(variantId)) return pathCache.get(variantId)!;
  const stops = getStopsForVariant(variantId);
  let path: VariantPath | null = null;
  if (stops.length > 0) {
    const pts: VariantPath["pts"] = [];
    const alongAt: number[] = [];
    const pathIdxByOrig = new Map<number, number>();
    let along = 0;
    for (let i = 0; i < stops.length; i++) {
      const c = getStopCoord(stops[i].stopId);
      if (!c) continue;
      if (pts.length > 0) {
        const prev = pts[pts.length - 1];
        along += distM(prev.lat, prev.lon, c.lat, c.lon);
      }
      pathIdxByOrig.set(i, pts.length);
      pts.push({ origIdx: i, lat: c.lat, lon: c.lon });
      alongAt.push(along);
    }
    if (pts.length > 0) path = { pts, alongAt, pathIdxByOrig };
  }
  pathCache.set(variantId, path);
  return path;
}

interface Projection {
  /** Distancia del GPS al punto proyectado sobre el recorrido (m). */
  snapDist: number;
  /** Distancia acumulada por el recorrido hasta el punto proyectado (m). */
  alongM: number;
  /** Índice en pts de la parada inmediatamente detrás de la proyección. */
  behindPathIdx: number;
  /** Fracción [0..1] recorrida del segmento behind→behind+1. */
  t: number;
}

/** Proyección del GPS sobre la polilínea de paradas (segmento más cercano). */
function projectOnPath(path: VariantPath, lat: number, lon: number): Projection {
  const { pts, alongAt } = path;
  if (pts.length === 1) {
    return { snapDist: distM(lat, lon, pts[0].lat, pts[0].lon), alongM: 0, behindPathIdx: 0, t: 0 };
  }
  // Plano local en metros centrado en el bus (suficiente a escala urbana).
  const kx = 111320 * Math.cos((lat * Math.PI) / 180);
  const ky = 111320;
  const px = 0, py = 0;
  const X = (lo: number) => (lo - lon) * kx;
  const Y = (la: number) => (la - lat) * ky;

  let best: Projection = { snapDist: Infinity, alongM: 0, behindPathIdx: 0, t: 0 };
  for (let i = 0; i < pts.length - 1; i++) {
    const ax = X(pts[i].lon), ay = Y(pts[i].lat);
    const bx = X(pts[i + 1].lon), by = Y(pts[i + 1].lat);
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 > 0 ? Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
    const qx = ax + t * dx, qy = ay + t * dy;
    const d = Math.hypot(px - qx, py - qy);
    if (d < best.snapDist) {
      const segLen = alongAt[i + 1] - alongAt[i];
      best = { snapDist: d, alongM: alongAt[i] + t * segLen, behindPathIdx: i, t };
    }
  }
  // Proyección exactamente sobre un vértice (t=1 del segmento anterior): el bus está
  // EN esa parada → contarla como "detrás", no como restante (semántica de remaining).
  if (best.t === 1 && best.behindPathIdx < pts.length - 1) {
    best.behindPathIdx += 1;
    best.t = 0;
  }
  return best;
}

// ─────────────────────────────────────────────────────────────────────────────
// Evaluación de candidatos
// ─────────────────────────────────────────────────────────────────────────────

/** Resultado de evaluar un recorrido candidato contra la posición GPS del bus. */
interface CandidateEval {
  variant: VariantCandidate;
  snapDist: number;
  currentSeq: number;
  targetSeq: number;
  remainingStops: number;
  etaSeconds: number;
  routeDistanceM: number;
}

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

  const path = getVariantPath(variant.variantId);
  if (!path) return { fail: "no-snap" }; // sin coords no podemos ubicar el bus

  // Posición de la parada target dentro del path (primera ocurrencia de la seq).
  const targetOrigIdx = stops.findIndex((s) => s.sequence === targetSeq);
  const targetPathIdx = targetOrigIdx >= 0 ? path.pathIdxByOrig.get(targetOrigIdx) : undefined;
  if (targetPathIdx == null) return { fail: "no-snap" }; // target sin coord → no podemos juzgar

  const proj = projectOnPath(path, bus.lat, bus.lon);
  if (proj.snapDist > MAX_GPS_SNAP_M) return { fail: "no-snap" };

  const targetAlong = path.alongAt[targetPathIdx];
  // Estrictamente PASADO en metros por el recorrido. En la parada misma (o ruido
  // de esquina ≤75m después) está LLEGANDO, no pasó.
  if (proj.alongM > targetAlong + PASSED_ALONG_MARGIN_M) return { fail: "passed" };

  const behind = path.pts[proj.behindPathIdx];
  const aheadPathIdx = Math.min(proj.behindPathIdx + 1, path.pts.length - 1);
  const ahead = path.pts[aheadPathIdx];
  const currentSeq = stops[behind.origIdx].sequence;
  const remainingStops = Math.max(0, targetPathIdx - proj.behindPathIdx);

  // ETA por horario GTFS del recorrido, interpolado dentro del segmento;
  // fallback a promedio por parada si falta el dato.
  const arrBehind = stops[behind.origIdx].arrivalSeconds;
  const arrAhead = stops[ahead.origIdx].arrivalSeconds;
  const arrTarget = stops[targetOrigIdx].arrivalSeconds;
  let arrCurrent = arrBehind;
  if (arrBehind > 0 && arrAhead >= arrBehind && proj.t > 0) {
    arrCurrent = arrBehind + proj.t * (arrAhead - arrBehind);
  }
  let etaSeconds: number;
  if (arrTarget > arrCurrent && arrCurrent > 0) {
    etaSeconds = Math.round(arrTarget - arrCurrent);
  } else {
    etaSeconds = remainingStops * AVG_SECONDS_PER_STOP;
  }

  // Distancia REAL siguiendo el recorrido: lo que falta desde la proyección.
  const routeDistanceM = Math.max(0, Math.round(targetAlong - proj.alongM));

  return {
    ok: { variant, snapDist: proj.snapDist, currentSeq, targetSeq, remainingStops, etaSeconds, routeDistanceM },
  };
}

/**
 * Determina si un bus en vivo va hacia una parada específica, usando GTFS.
 *
 * Cada línea tiene varios recorridos distintos (la 76 tiene 9). Para saber por
 * CUÁL va el bus:
 *   1. Candidatos = recorridos de la línea cuyo headsign matchea el destino
 *      del bus (si ninguno matchea, se prueban todos).
 *   2. Cada candidato que PASA por la parada se evalúa proyectando el GPS.
 *   3. Se elige el que mejor ajusta al GPS (menor distancia de proyección) —
 *      ese es el recorrido físico que el bus está siguiendo realmente.
 *
 * Esto arregla de raíz:
 *   - "76 por la calle paralela": se elige el recorrido cuyo trazo sigue la
 *     posición real del bus, no uno colapsado.
 *   - Buses-fantasma: un "PORTONES SHOPPING" corto NO contiene paradas más
 *     allá del shopping → si la parada target está después, ese candidato se
 *     descarta y el bus no se muestra (correcto, no va a llegar).
 *   - "Me dice que llega y acaba de pasar": la proyección sobre el recorrido
 *     detecta el "ya pasó" en metros, no en paradas enteras.
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
  //    - "passed": el bus se proyectó sobre una variante que incluye la parada y quedó ATRÁS.
  //    - "no-position": la parada está en alguna variante pero el GPS no snapeó (lejos/fuera
  //      de ruta) → incierto, NO lo tratamos como pasado.
  const evals: CandidateEval[] = [];
  let sawStop = false;   // la parada está en alguna variante candidata
  let sawPassed = false; // se proyectó y quedó atrás en alguna
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

  return {
    goingTo: true,
    matchedHeadsign: best.variant.headsign,
    currentSequence: best.currentSeq,
    targetSequence: best.targetSeq,
    remainingStops: best.remainingStops,
    etaSeconds: best.etaSeconds,
    routeDistanceM: best.routeDistanceM,
  };
}

/**
 * Chequeo de RESPALDO honesto: ¿el bus probablemente YA PASÓ la parada?
 *
 * `busTowardsStopGtfs` exige que el GPS proyecte a ≤900m del recorrido. Pero un
 * bus que ya pasó y va lejos (o por una calle paralela) cae en "no-position", y
 * como confiamos en el STM (trustUpstream) se mostraba igual → bug del usuario:
 * "estoy en la 160, el bus está en la 162 y me dice que llega".
 *
 * Esta función NO usa el límite de snap: toma la variante de la línea que mejor
 * ajusta al GPS (por headsign), proyecta el bus sobre su recorrido sea cual sea
 * la distancia, y si la proyección quedó más de LIKELY_PASSED_MARGIN_M después
 * de la parada objetivo → el bus ya la dejó atrás.
 *
 * Devuelve true SOLO si está razonablemente seguro de que pasó; ante la duda,
 * false (preferimos mostrar de más que ocultar un bus que sí viene).
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
  // (proyección más cercana). Comparar su posición por el recorrido con la del objetivo.
  let bestSnap = Infinity;
  let passedOnBest = false;
  let evaluatedAny = false;
  for (const v of candidates) {
    const targetSeq = getStopSequence(v.variantId, targetStopId);
    if (targetSeq == null) continue; // esta variante no pasa por la parada
    const stops = getStopsForVariant(v.variantId);
    if (stops.length === 0) continue;
    const path = getVariantPath(v.variantId);
    if (!path) continue;
    const targetOrigIdx = stops.findIndex((s) => s.sequence === targetSeq);
    const targetPathIdx = targetOrigIdx >= 0 ? path.pathIdxByOrig.get(targetOrigIdx) : undefined;
    if (targetPathIdx == null) continue;
    const proj = projectOnPath(path, bus.lat, bus.lon);
    evaluatedAny = true;
    if (proj.snapDist < bestSnap) {
      bestSnap = proj.snapDist;
      passedOnBest = proj.alongM > path.alongAt[targetPathIdx] + LIKELY_PASSED_MARGIN_M;
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
