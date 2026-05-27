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
  findVariantForBus,
  getStopSequence,
  getStopsForVariant,
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

/**
 * Determina si un bus en vivo va hacia una parada específica, usando GTFS.
 *
 * Inputs:
 *   bus: posición + línea + destination (headsign de la API live)
 *   targetStopId: id de la parada destino
 */
export function busTowardsStopGtfs(
  bus: VehiclePosition & { destinoDesc?: string },
  targetStopId: string
): GtfsCheckResult {
  // 1. Encontrar variante GTFS para este bus
  const destination = bus.destinoDesc || "";
  const variant = findVariantForBus(bus.lineName, destination);
  if (!variant) {
    return { goingTo: false, reason: "no-variant" };
  }

  // 2. ¿La parada está en el recorrido de esa variante?
  const targetSeq = getStopSequence(variant.variantId, targetStopId);
  if (targetSeq == null) {
    return {
      goingTo: false,
      reason: "stop-not-in-route",
      matchedHeadsign: variant.headsign,
    };
  }

  // 3. Calcular posición actual: parada del recorrido más cercana al bus
  const stops = getStopsForVariant(variant.variantId);
  if (stops.length === 0) {
    return {
      goingTo: false,
      reason: "no-position",
      matchedHeadsign: variant.headsign,
    };
  }

  let bestStopIdx = -1;
  let bestDist = Infinity;
  for (let i = 0; i < stops.length; i++) {
    const coord = getStopCoord(stops[i].stopId);
    if (!coord) continue;
    const d = distM(bus.lat, bus.lon, coord.lat, coord.lon);
    if (d < bestDist) {
      bestDist = d;
      bestStopIdx = i;
    }
  }

  if (bestStopIdx === -1) {
    return {
      goingTo: false,
      reason: "no-position",
      matchedHeadsign: variant.headsign,
    };
  }

  const currentStop = stops[bestStopIdx];
  const currentSeq = currentStop.sequence;

  // Salvaguarda: si el bus está muy lejos de la parada GTFS más cercana,
  // el GPS no es confiable o el bus está fuera de ruta.
  if (bestDist > MAX_GPS_SNAP_M) {
    return {
      goingTo: false,
      reason: "no-position",
      matchedHeadsign: variant.headsign,
      currentSequence: currentSeq,
      targetSequence: targetSeq,
    };
  }

  // 4. ¿Ya pasó la parada?
  if (currentSeq >= targetSeq) {
    return {
      goingTo: false,
      reason: "passed",
      matchedHeadsign: variant.headsign,
      currentSequence: currentSeq,
      targetSequence: targetSeq,
    };
  }

  // 5. Va hacia la parada — calcular ETA + distancia REAL del recorrido
  const remainingStops = targetSeq - currentSeq;

  // ETA basado en horario GTFS del trip representativo
  const arrCurrent = stops[bestStopIdx].arrivalSeconds;
  const targetStopRow = stops.find((s) => s.sequence === targetSeq);
  const arrTarget = targetStopRow?.arrivalSeconds || 0;
  let etaSeconds: number;
  if (arrTarget > arrCurrent && arrCurrent > 0) {
    etaSeconds = arrTarget - arrCurrent;
  } else {
    etaSeconds = remainingStops * AVG_SECONDS_PER_STOP;
  }

  // Distancia REAL: suma haversine entre paradas consecutivas del trip
  // (no haversine bus↔parada — la 76 va dando una vuelta enorme)
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
