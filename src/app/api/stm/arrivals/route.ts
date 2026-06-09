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
  getLastDepartureForLine,
} from "@/lib/schedule-db";
import { detectLastBus } from "@/lib/delay-prediction";
import {
  isMvdApiConfigured,
  getBuses,
  type MvdBus,
} from "@/lib/mvd-api";
import { findStopServer } from "@/lib/stops-server";
import { busTowardsStopGtfs, busLikelyPassedStop } from "@/lib/bus-direction-gtfs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Haversine en metros (server-side, sin depender de utils de cliente). */
function distM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Convierte un bus crudo en Arrival.
 *
 * `trustUpstream` (feedback Guille — destinos acortados):
 *   - true  → el bus viene del filtro OFICIAL del STM (busstopId), que ya confirma
 *     que va hacia la parada. Confiamos en el STM: usamos GTFS solo para ENRIQUECER
 *     (ETA por paradas, acortado); si GTFS no lo ubica (típico de madrugada con
 *     recorridos acortados que no están en nuestras variantes), igual lo mostramos
 *     con ETA estimada por distancia. NO lo descartamos.
 *   - false → fuente no confirmada (buses?lines, tracking lejano). Mantiene el filtro
 *     GTFS estricto como red de seguridad (evita "buses ya pasados").
 */
function mapBusToArrivalWithGtfs(b: MvdBus, targetStopId: string, trustUpstream = false): Arrival | null {
  const lat = b.location.coordinates[1];
  const lon = b.location.coordinates[0];
  const vehicle = {
    vehicleId: String(b.busId),
    lineId: b.line,
    lineName: b.line,
    lat, lon,
    bearing: 0,
    speed: b.speed || 0,
    timestamp: Date.parse(b.timestamp) || Date.now(),
    variantCode: b.lineVariantId,
    destinoDesc: b.destination,
  };
  const check = busTowardsStopGtfs(vehicle, targetStopId);

  const base = {
    lineId: b.line,
    lineName: b.line,
    lineColor: lineColorFromCode(b.line),
    destination: b.destination, // SIEMPRE el destino que reporta el GPS en vivo (acortado real)
    destinationCode: b.lineVariantId,
    vehicleId: String(b.busId),
    lat, lon,
    realtime: true as const,
    access: b.access,
    thermalConfort: b.thermalConfort,
    company: b.company,
  };

  if (!check.goingTo) {
    // Fuente lejana no confirmada → filtro estricto.
    if (!trustUpstream) return null;
    // Aunque sea fuente oficial del STM: si el GTFS está SEGURO de que el bus YA PASÓ
    // la parada, descartarlo (el filtro del STM a veces incluye pasados / sentido
    // contrario). Solo confiamos en el STM cuando el GTFS NO puede ubicarlo.
    if (check.reason === "passed") return null;
    // Respaldo: aunque el GTFS no haya podido snapear (reason "no-position"/"no-snap"),
    // si geométricamente el bus quedó MÁS ALLÁ de la parada, ya pasó → no mostrar.
    // Esto arregla el caso "estoy en la 160, el bus está en la 162 y me dice que llega".
    if (busLikelyPassedStop({ lat, lon, lineName: b.line, destinoDesc: b.destination }, targetStopId)) return null;
    // Fuente oficial del STM, GTFS incierto → confiar. ETA estimada por distancia.
    const stop = findStopServer(targetStopId);
    let etaSeconds = 0;
    if (stop) {
      const d = distM(lat, lon, stop.stopLat, stop.stopLon);
      const speedMs = (vehicle.speed > 3 ? vehicle.speed : 16) * 1000 / 3600; // 16 km/h urbano por defecto
      etaSeconds = Math.round(d / speedMs);
    }
    // etaApprox: este ETA salió de distancia+velocidad asumida, no del recorrido GTFS
    // → menos preciso. La UI lo marca con "~" para ser honesta sobre la incertidumbre.
    return { ...base, eta: Math.max(0, Math.round(etaSeconds / 60)), etaSeconds, distance: 0, isShortened: false, etaApprox: true };
  }

  const etaSeconds = check.etaSeconds ?? 0;
  const officialHeadsign = check.matchedHeadsign || "";
  const isShortened = officialHeadsign.length > 0 &&
    !normalizeForCompare(b.destination).includes(normalizeForCompare(officialHeadsign)) &&
    !normalizeForCompare(officialHeadsign).includes(normalizeForCompare(b.destination));

  return {
    ...base,
    eta: Math.max(0, Math.round(etaSeconds / 60)),
    etaSeconds,
    distance: check.routeDistanceM ?? 0,
    remainingStops: check.remainingStops,
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

/** Mapea horarios programados (schedule.db / metro-schedule.db) a Arrival. Sin GPS:
 *  realtime=false, isScheduled=true (la UI los marca como "horario", no inventa posición). */
function scheduledToArrivals(sched: ReturnType<typeof getScheduledArrivalsForStop>): Arrival[] {
  return sched.slice(0, 20).map((s) => ({
    lineId: s.lineCode,
    lineName: s.lineCode,
    lineColor: lineColorFromCode(s.lineCode),
    destination: s.lineCode,
    destinationCode: 0,
    eta: Math.max(0, s.minutesFromNow),
    etaSeconds: Math.max(0, s.minutesFromNow) * 60,
    realtime: false,
    isScheduled: true,
  }));
}

export async function GET(req: NextRequest) {
  const stopId = req.nextUrl.searchParams.get("stopId");
  if (!stopId || stopId.length > 30) {
    return NextResponse.json({ error: "stopId requerido o inválido" }, { status: 400 });
  }

  try {
    const stopInfo: StopInfo | null = await getStopVariants(stopId);
    if (!stopInfo) {
      // Paradas METRO (Canelones, prefijo "M"): la API STM urbana no las conoce, así
      // que getStopVariants da null. Pero su HORARIO programado vive en metro-schedule.db.
      // Antes salíamos con "no-info" → la parada se veía "Sin buses próximamente" aunque
      // tuviéramos los horarios. Acá los servimos (no hay GPS en vivo del metro, es honesto).
      const metroSched = scheduledToArrivals(getScheduledArrivalsForStop(stopId));
      if (metroSched.length > 0) {
        return NextResponse.json(
          { arrivals: metroSched, stopId, updatedAt: Date.now(), source: "metro-schedule", degraded: true },
          { headers: { "Cache-Control": "no-store, max-age=0" } }
        );
      }
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
      // upcomingbuses devuelve 400 desde mayo 2026 — API de MVD lo desactivó o cambió contrato.
      // Fuente primaria: buses?busstopId (filtra upstream server-side + trae access/thermalConfort)
      // + buses?lines (tracking lejano — ve buses a más de 2km que el busstopId no incluye).
      const ourLines = new Set(lineCodes);

      const [upstream, allOfLines] = await Promise.all([
        getBuses({ busstopId: stopId }).catch(() => [] as MvdBus[]),
        getBuses({ lines: lineCodes }).catch(() => [] as MvdBus[]),
      ]);

      if (upstream.length > 0) {
        const relevant = upstream.filter((b) => ourLines.has(b.line));
        const filtered = relevant
          .map((b) => mapBusToArrivalWithGtfs(b, stopId, true)) // confiar en el filtro oficial del STM
          .filter((a): a is Arrival => a !== null);
        liveArrivals.push(...filtered);
        if (filtered.length > 0) sources.push("buses-upstream-gtfs");
      }

      // Tracking lejano: agrega buses que el endpoint upstream no incluyó todavía
      if (allOfLines.length > 0) {
        const knownIds = new Set(liveArrivals.map((a) => a.vehicleId));
        const farther = allOfLines
          .filter((b) => !knownIds.has(String(b.busId)) && ourLines.has(b.line))
          .map((b) => mapBusToArrivalWithGtfs(b, stopId))
          .filter((a): a is Arrival => a !== null);
        if (farther.length > 0) {
          liveArrivals.push(...farther);
          sources.push("gtfs-far-tracking");
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

    // ─── F1.4: confianza honesta (último bus + atraso observado) ───
    // Por cada línea distinta, su última corrida programada del día (dato duro).
    // Marcamos el PRIMER arrival de cada línea que coincide con esa última hora.
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
    const lastByLine = new Map<string, number | null>();
    const markedLastLine = new Set<string>();
    for (const a of combined) {
      if (!lastByLine.has(a.lineName)) {
        lastByLine.set(a.lineName, getLastDepartureForLine(stopId, a.lineName));
      }
      const lastHora = lastByLine.get(a.lineName) ?? null;
      const arrivalHora = nowMin + a.eta;
      const lb = detectLastBus(arrivalHora, lastHora, nowMin);
      if (lb.isLastOfDay && !markedLastLine.has(a.lineName)) {
        a.isLastOfDay = true;
        markedLastLine.add(a.lineName);
      }
    }

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
    // Último recurso: si TODO lo de arriba falló (incluso getStopVariants), igual
    // intentamos los horarios programados locales (schedule.db) en vez de devolver vacío.
    // "Si no carga el tiempo real, mostrá los horarios estimados" (feedback usuario).
    try {
      const arrivals = scheduledToArrivals(getScheduledArrivalsForStop(stopId));
      if (arrivals.length > 0) {
        return NextResponse.json(
          { arrivals, stopId, updatedAt: Date.now(), source: "schedule-only", degraded: true },
          { headers: { "Cache-Control": "no-store, max-age=0" } }
        );
      }
    } catch {}
    return NextResponse.json(
      { arrivals: [], stopId, updatedAt: Date.now(), error: "API STM no disponible" },
      { status: 200 }
    );
  }
}
