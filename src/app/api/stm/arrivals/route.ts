/**
 * GET /api/stm/arrivals?stopId=X
 *
 * SRS FR-1 + FR-1.5: combinación inteligente live + schedule.
 *
 * Estrategia:
 *   1. Recolectar buses LIVE de múltiples fuentes (oficial + fallback)
 *   2. Para cada línea SIN bus live, agregar el próximo horario programado
 *   3. Combinar, deduplicar por vehicleId, ordenar por ETA
 *
 * Esto resuelve el bug "187 a 23:14 no se ve porque hay 329 en vivo":
 *   ahora SIEMPRE se ve el próximo de cada línea (live o scheduled).
 */
import { NextRequest, NextResponse } from "next/server";
import {
  getArrivalsForStop,
  getStopVariants,
  lineColorFromCode,
  type StopInfo,
  type Arrival,
} from "@/lib/stm";
import {
  getScheduledArrivalsForStop,
  getNextScheduledPerLine,
} from "@/lib/schedule-db";
import {
  isMvdApiConfigured,
  getUpcomingBuses,
  getBuses,
  type MvdUpcomingBus,
  type MvdBus,
} from "@/lib/mvd-api";
import { findStopServer } from "@/lib/stops-server";
import { busTowardsStopGtfs } from "@/lib/bus-direction-gtfs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mapUpcomingToArrival(u: MvdUpcomingBus, stopId?: string): Arrival {
  // upcomingBuses ya viene con ETA calculado por el backend STM con GPS real.
  // Usamos ese ETA como fuente primaria — NO lo sobreescribimos con estimación GTFS.
  // GTFS solo se consulta para enriquecer: paradas restantes, distancia real, isShortened.
  let remainingStops: number | undefined;
  let routeDistanceM: number | undefined;
  let isShortened = false;
  if (stopId && u.location?.coordinates) {
    const vehicle = {
      vehicleId: String(u.busId),
      lineId: u.line,
      lineName: u.line,
      lat: u.location.coordinates[1],
      lon: u.location.coordinates[0],
      bearing: 0,
      speed: 0,
      timestamp: Date.now(),
      variantCode: u.lineVariantId,
      destinoDesc: u.destination,
    };
    const check = busTowardsStopGtfs(vehicle, stopId);
    if (check.goingTo) {
      remainingStops = check.remainingStops;
      routeDistanceM = check.routeDistanceM;
      const official = check.matchedHeadsign || "";
      isShortened = official.length > 0 &&
        !normalizeForCompare(u.destination).includes(normalizeForCompare(official)) &&
        !normalizeForCompare(official).includes(normalizeForCompare(u.destination));
    }
  }

  // ETA oficial STM (GPS real, calculado por el backend de IM).
  // Nota: u.eta viene en segundos. Math.round para evitar saltos de ±30s.
  const etaSeconds = Math.max(0, u.eta);
  return {
    lineId: u.line,
    lineName: u.line,
    lineColor: lineColorFromCode(u.line),
    destination: u.destination,
    destinationCode: u.lineVariantId,
    eta: Math.round(etaSeconds / 60),
    etaSeconds,
    // Distancia REAL del recorrido (GTFS) si disponible, fallback al dato STM oficial
    distance: routeDistanceM ?? u.distance,
    remainingStops,
    vehicleId: String(u.busId),
    lat: u.location?.coordinates?.[1],
    lon: u.location?.coordinates?.[0],
    realtime: true,
    access: u.access,
    thermalConfort: u.thermalConfort,
    isShortened,
  };
}

/**
 * Convierte un bus crudo en Arrival aplicando filtro GTFS:
 * - Si el bus va por una variante que NO pasa por la parada → devuelve null
 * - Si ya pasó la parada → devuelve null
 * - Si va hacia → calcula ETA real basada en paradas restantes del trip GTFS,
 *   NO por haversine.
 */
function mapBusToArrivalWithGtfs(b: MvdBus, targetStopId: string): Arrival | null {
  const vehicle = {
    vehicleId: String(b.busId),
    lineId: b.line,
    lineName: b.line,
    lat: b.location.coordinates[1],
    lon: b.location.coordinates[0],
    bearing: 0,
    speed: b.speed || 0,
    timestamp: Date.parse(b.timestamp) || Date.now(),
    variantCode: b.lineVariantId,
    destinoDesc: b.destination,
  };
  const check = busTowardsStopGtfs(vehicle, targetStopId);
  if (!check.goingTo) return null;

  const etaSeconds = check.etaSeconds ?? 0;

  // SRS FR-6.x (feedback Guille): detectar trayecto acortado real.
  // Si el destino REAL del bus (b.destination, lo que reporta el GPS en vivo) difiere
  // del headsign GTFS oficial (la variante "completa"), es un acortado/desvío.
  // Comparamos normalizado para tolerar mayúsculas/acentos/paréntesis.
  const officialHeadsign = check.matchedHeadsign || "";
  const isShortened = officialHeadsign.length > 0 &&
    !normalizeForCompare(b.destination).includes(normalizeForCompare(officialHeadsign)) &&
    !normalizeForCompare(officialHeadsign).includes(normalizeForCompare(b.destination));

  return {
    lineId: b.line,
    lineName: b.line,
    lineColor: lineColorFromCode(b.line),
    destination: b.destination,
    destinationCode: b.lineVariantId,
    eta: Math.max(0, Math.round(etaSeconds / 60)),
    etaSeconds,
    distance: check.routeDistanceM ?? 0,
    remainingStops: check.remainingStops,
    vehicleId: String(b.busId),
    lat: b.location.coordinates[1],
    lon: b.location.coordinates[0],
    realtime: true,
    access: b.access,
    thermalConfort: b.thermalConfort,
    isShortened,
  };
}

function normalizeForCompare(s: string): string {
  return s.toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Toma varias fuentes de arrivals live y deduplica por vehicleId, prefiriendo el de menor ETA. */
function dedupeLive(arrivals: Arrival[]): Arrival[] {
  const byVehicle = new Map<string, Arrival>();
  for (const a of arrivals) {
    if (!a.vehicleId) continue;
    const ex = byVehicle.get(a.vehicleId);
    if (!ex || a.eta < ex.eta) byVehicle.set(a.vehicleId, a);
  }
  return [...byVehicle.values()];
}

export async function GET(req: NextRequest) {
  const stopId = req.nextUrl.searchParams.get("stopId");
  if (!stopId) {
    return NextResponse.json({ error: "stopId requerido" }, { status: 400 });
  }

  try {
    const stopInfo: StopInfo | null = await getStopVariants(stopId);
    if (!stopInfo) {
      return NextResponse.json({ arrivals: [], stopId, updatedAt: Date.now(), source: "no-info" });
    }

    const lineCodes = stopInfo.variants.map((v) => v.lineCode);
    if (lineCodes.length === 0) {
      return NextResponse.json({ arrivals: [], stopId, updatedAt: Date.now(), source: "no-lines" });
    }

    const stop = findStopServer(stopId);

    // ─── FUENTES LIVE (en paralelo cuando posible) ───
    const liveArrivals: Arrival[] = [];
    const sources: string[] = [];

    if (isMvdApiConfigured() && stop) {
      // En paralelo: upcomingbuses + buses upstream (la API tiene rate limit pero estos son distintos endpoints)
      const [upcoming, upstream] = await Promise.all([
        getUpcomingBuses(stopId, lineCodes, 5).catch(() => []),
        getBuses({ busstopId: stopId }).catch(() => []),
      ]);

      if (upcoming.length > 0) {
        liveArrivals.push(...upcoming.map((u) => mapUpcomingToArrival(u, stopId)));
        sources.push("upcoming");
      }

      if (upstream.length > 0 && stop) {
        // SRS FR-2.7: filtrar con GTFS — descarta variantes que no pasan por la parada
        // o buses que ya pasaron. ETA basada en paradas restantes del trip oficial.
        const ourLines = new Set(lineCodes);
        const relevant = upstream.filter((b) => ourLines.has(b.line));
        const filtered = relevant
          .map((b) => mapBusToArrivalWithGtfs(b, stopId))
          .filter((a): a is Arrival => a !== null);
        liveArrivals.push(...filtered);
        if (filtered.length > 0) sources.push("buses-upstream-gtfs");
      }

      // Tracking lejano: traer todos los buses de las líneas y filtrar por GTFS.
      // Resuelve "329 aparece recién a 2 cuadras" — ahora aparece desde lejos si va a la parada.
      if (stop) {
        const allOfLines = await getBuses({ lines: lineCodes }).catch(() => [] as MvdBus[]);
        if (allOfLines.length > 0) {
          const knownIds = new Set(liveArrivals.map((a) => a.vehicleId));
          const farther = allOfLines
            .filter((b) => !knownIds.has(String(b.busId)))
            .map((b) => mapBusToArrivalWithGtfs(b, stopId))
            .filter((a): a is Arrival => a !== null);
          if (farther.length > 0) {
            liveArrivals.push(...farther);
            sources.push("gtfs-far-tracking");
          }
        }
      }
    }

    // Fallback legacy si la API autenticada no dio nada
    if (liveArrivals.length === 0) {
      const legacy = await getArrivalsForStop(stopId).catch(() => [] as Arrival[]);
      const legacyLive = legacy.filter((a) => a.realtime);
      if (legacyLive.length > 0) {
        liveArrivals.push(...legacyLive);
        sources.push("legacy-gps");
      }
    }

    // Deduplicar por vehicleId
    const liveDedup = dedupeLive(liveArrivals);

    // ─── COMPLETAR LÍNEAS SIN LIVE CON SCHEDULE ───
    // SRS FR-1.5: cada línea de la parada debe tener al menos un "próximo"
    const linesWithLive = new Set(liveDedup.map((a) => a.lineName));
    const linesNeedingSchedule = lineCodes.filter((l) => !linesWithLive.has(l));

    const scheduledArrivals: Arrival[] = [];
    if (linesNeedingSchedule.length > 0) {
      const lineDestMap = new Map<string, string>();
      for (const v of stopInfo.variants) {
        if (!lineDestMap.has(v.lineCode) && v.destinations.length > 0) {
          lineDestMap.set(v.lineCode, v.destinations[0].name);
        }
      }
      // Próximo schedule para cada línea sin live (ventana extendida a 3h)
      const nextPerLine = getNextScheduledPerLine(stopId, linesNeedingSchedule, 180);
      for (const s of nextPerLine) {
        scheduledArrivals.push({
          lineId: s.lineCode,
          lineName: s.lineCode,
          lineColor: lineColorFromCode(s.lineCode),
          destination: lineDestMap.get(s.lineCode) || s.lineCode,
          destinationCode: 0,
          eta: Math.max(0, s.minutesFromNow),
          etaSeconds: Math.max(0, s.minutesFromNow) * 60,
          realtime: false,
          isScheduled: true,
        });
      }
      if (scheduledArrivals.length > 0) sources.push("schedule-completion");
    }

    // ─── CASO ÚLTIMA INSTANCIA: ningún live, ningún programado próximo por línea ───
    // Usar el dataset general de schedule para devolver lo que haya
    let combined: Arrival[] = [...liveDedup, ...scheduledArrivals];
    if (combined.length === 0) {
      const fallbackSched = getScheduledArrivalsForStop(stopId);
      if (fallbackSched.length > 0) {
        const lineDestMap = new Map<string, string>();
        for (const v of stopInfo.variants) {
          if (!lineDestMap.has(v.lineCode) && v.destinations.length > 0) {
            lineDestMap.set(v.lineCode, v.destinations[0].name);
          }
        }
        combined = fallbackSched.slice(0, 15).map((s) => ({
          lineId: s.lineCode,
          lineName: s.lineCode,
          lineColor: lineColorFromCode(s.lineCode),
          destination: lineDestMap.get(s.lineCode) || s.lineCode,
          destinationCode: 0,
          eta: Math.max(0, s.minutesFromNow),
          etaSeconds: Math.max(0, s.minutesFromNow) * 60,
          realtime: false,
          isScheduled: true,
        }));
        sources.push("schedule-fallback");
      }
    }

    // Ordenar por ETA y limitar
    combined.sort((a, b) => a.eta - b.eta);
    combined = combined.slice(0, 25);

    return NextResponse.json(
      {
        arrivals: combined,
        stopId,
        updatedAt: Date.now(),
        source: sources.join("+") || "empty",
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (err) {
    console.error("[/api/stm/arrivals] error:", err);
    return NextResponse.json(
      { arrivals: [], stopId, updatedAt: Date.now(), error: "API STM no disponible" },
      { status: 200 }
    );
  }
}
