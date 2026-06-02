/**
 * Filtro upstream de buses (SRS FR-2):
 * Determina si un bus va HACIA una parada, o si ya pasó.
 *
 * Estrategia: proyectar GPS del bus sobre la polyline de su variante,
 * proyectar también la parada, y comparar índices en el sentido del recorrido.
 *
 * - bus_idx < stop_idx → bus aún no llegó → INCLUIR (upstream)
 * - bus_idx >= stop_idx → bus ya pasó → DESCARTAR (downstream)
 *
 * Salvaguardas:
 * - Si el bus está a >MAX_OFFROUTE_M de la polyline → DESCARTAR (GPS sospechoso, ruta cambiada, fuera de servicio)
 * - Si no hay polyline para esa variante/línea → INCLUIR por defecto (no podemos juzgar)
 * - Si la polyline tiene <2 puntos → INCLUIR por defecto
 */

import type { VehiclePosition } from "@/lib/stm";

/** Distancia máxima del bus a la polyline antes de considerar GPS sospechoso. */
const MAX_OFFROUTE_M = 500;

/** Tolerancia para "el bus ya llegó pero todavía no se fue" (en metros sobre la polyline). */
const ARRIVAL_TOLERANCE_M = 80;

/**
 * SRS FR-2.5: tope de distancia restante por la polyline.
 * Bus upstream pero muy lejos = ruido visual. 4500m a 16km/h ≈ 17 minutos máximo.
 * Razón: el usuario no quiere ver un bus a 7km de su parada con ETA 25min,
 * quiere ver lo que realmente va a pasar pronto.
 */
const MAX_REMAINING_M = 4500;

interface RoutesIndex {
  [key: string]: [number, number][];
}

/**
 * Proyecta un punto sobre una polyline y devuelve:
 *  - segmentIdx: índice del segmento donde cae la proyección
 *  - distAlong: distancia acumulada sobre la polyline hasta el punto proyectado (metros)
 *  - distToLine: distancia perpendicular del punto a la polyline (metros)
 */
function projectOnPolyline(
  lat: number,
  lon: number,
  polyline: [number, number][]
): { segmentIdx: number; distAlong: number; distToLine: number } {
  let bestIdx = 0;
  let bestDist = Infinity;
  let bestDistAlong = 0;
  let cumDist = 0;

  for (let i = 0; i < polyline.length - 1; i++) {
    const [aLat, aLon] = polyline[i];
    const [bLat, bLon] = polyline[i + 1];

    // Aproximación: tratar como plano local (suficiente para distancias urbanas cortas).
    // Convertir a metros usando equirectangular projection alrededor del punto a.
    const cosLat = Math.cos((aLat * Math.PI) / 180);
    const ax = 0;
    const ay = 0;
    const bx = (bLon - aLon) * cosLat * 111320;
    const by = (bLat - aLat) * 111320;
    const px = (lon - aLon) * cosLat * 111320;
    const py = (lat - aLat) * 111320;

    const dx = bx - ax;
    const dy = by - ay;
    const segLenSq = dx * dx + dy * dy;
    let t = segLenSq > 0 ? (px * dx + py * dy) / segLenSq : 0;
    t = Math.max(0, Math.min(1, t));

    const projX = ax + t * dx;
    const projY = ay + t * dy;
    const distM = Math.hypot(px - projX, py - projY);

    if (distM < bestDist) {
      bestDist = distM;
      bestIdx = i;
      const segLen = Math.sqrt(segLenSq);
      bestDistAlong = cumDist + t * segLen;
    }

    cumDist += Math.sqrt(segLenSq);
  }

  return {
    segmentIdx: bestIdx,
    distAlong: bestDistAlong,
    distToLine: bestDist,
  };
}

export interface UpstreamCheckResult {
  /** true si el bus está antes de la parada en el sentido del recorrido (yendo HACIA). */
  isUpstream: boolean;
  /** Distancia del bus al recorrido (metros). Alto = GPS sospechoso. */
  offrouteM: number;
  /** Distancia desde el bus hasta la parada SIGUIENDO la polyline (metros). null si no aplica. */
  remainingRouteM: number | null;
  /** Razón del descarte si !isUpstream. */
  reason?: "passed" | "offroute" | "no-polyline" | "too-far" | "no-variant";
}

/**
 * Determina si `bus` va hacia `stop` siguiendo la polyline de su variante.
 *
 * SRS FR-2.6: solo usamos `routes[variantCode]` (variante exacta). NO hacemos fallback
 * a `routes[lineName]` porque otra variante de la misma línea puede ir en sentido contrario.
 * Si la variante exacta no está en routes.json y SÍ hay otra variante de la línea,
 * descartamos el bus (no podemos garantizar sentido).
 *
 * Si la línea ENTERA no está en routes.json (no podemos juzgar), incluimos por defecto
 * (better safe than sorry — al menos el usuario lo ve).
 */
export function isBusGoingToStop(
  bus: VehiclePosition,
  stopLat: number,
  stopLon: number,
  routes: RoutesIndex
): UpstreamCheckResult {
  // Solo usar la variante exacta. Sin fallback a lineName (puede ser sentido contrario).
  const variantKey = bus.variantCode != null ? String(bus.variantCode) : "";
  const variantPolyline = variantKey ? routes[variantKey] : null;

  if (!variantPolyline || variantPolyline.length < 2) {
    // ¿La línea existe en routes.json pero con otra variante?
    // Si sí → descartar (no podemos garantizar sentido).
    // Si no → incluir (no podemos juzgar de ningún modo).
    const lineExists = !!routes[bus.lineName];
    if (lineExists) {
      return {
        isUpstream: false,
        offrouteM: 0,
        remainingRouteM: null,
        reason: "no-variant",
      };
    }
    return {
      isUpstream: true,
      offrouteM: 0,
      remainingRouteM: null,
      reason: "no-polyline",
    };
  }

  const polyline = variantPolyline;

  const busProj = projectOnPolyline(bus.lat, bus.lon, polyline);
  const stopProj = projectOnPolyline(stopLat, stopLon, polyline);

  // Salvaguarda 1: bus muy lejos del recorrido (ruta cambiada, fuera de servicio, GPS roto)
  if (busProj.distToLine > MAX_OFFROUTE_M) {
    return {
      isUpstream: false,
      offrouteM: busProj.distToLine,
      remainingRouteM: null,
      reason: "offroute",
    };
  }

  // Si el bus está prácticamente en la parada (parado en ella), considerarlo "llegando" todavía
  if (Math.abs(busProj.distAlong - stopProj.distAlong) < ARRIVAL_TOLERANCE_M) {
    return {
      isUpstream: true,
      offrouteM: busProj.distToLine,
      remainingRouteM: 0,
    };
  }

  // bus ya pasó la parada
  if (busProj.distAlong >= stopProj.distAlong) {
    return {
      isUpstream: false,
      offrouteM: busProj.distToLine,
      remainingRouteM: null,
      reason: "passed",
    };
  }

  // Upstream — calcular distancia restante por la polyline
  const remainingM = stopProj.distAlong - busProj.distAlong;

  // SRS FR-2.5: descartar si está demasiado lejos (>17 min de viaje)
  if (remainingM > MAX_REMAINING_M) {
    return {
      isUpstream: false,
      offrouteM: busProj.distToLine,
      remainingRouteM: remainingM,
      reason: "too-far",
    };
  }

  return {
    isUpstream: true,
    offrouteM: busProj.distToLine,
    remainingRouteM: remainingM,
  };
}

/**
 * Filtra una lista de buses para quedarse solo con los que van hacia `stop`.
 * Si el cache de rutas todavía no cargó, devuelve la lista completa (no podemos filtrar).
 */
export function filterUpstreamBuses(
  buses: VehiclePosition[],
  stopLat: number,
  stopLon: number,
  routes: RoutesIndex | null
): VehiclePosition[] {
  if (!routes) return buses; // sin rutas todavía → no filtramos
  return buses.filter((b) => isBusGoingToStop(b, stopLat, stopLon, routes).isUpstream);
}

/**
 * Para un bus específico, calcula su ETA estimada hasta la parada
 * basándose en la distancia restante por la polyline (más realista que haversine).
 */
export function estimateBusEtaSeconds(
  bus: VehiclePosition,
  stopLat: number,
  stopLon: number,
  routes: RoutesIndex | null,
  avgSpeedMs = 6.5
): number | null {
  if (!routes) return null;
  const check = isBusGoingToStop(bus, stopLat, stopLon, routes);
  if (!check.isUpstream || check.remainingRouteM == null) return null;
  return Math.round(check.remainingRouteM / avgSpeedMs);
}
