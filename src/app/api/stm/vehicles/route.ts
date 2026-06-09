/**
 * GET /api/stm/vehicles?lineIds=76,329&stopId=3790
 *
 * Cuando hay stopId + lineIds, devuelve SOLO los buses que van hacia esa parada,
 * filtrados con GTFS (SRS FR-2.7):
 *   - Variante del bus debe pasar por la parada
 *   - Bus no debe haber pasado ya (current_sequence < target_sequence)
 *
 * Cuando hay solo lineIds, devuelve todos los buses de esas líneas.
 */
import { NextRequest, NextResponse } from "next/server";
import { getVehiclePositions, type VehiclePosition } from "@/lib/stm";
import { isMvdApiConfigured, getBuses, type MvdBus } from "@/lib/mvd-api";
import { busTowardsStopGtfs, busLikelyPassedStop } from "@/lib/bus-direction-gtfs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mvdBusToVehicle(b: MvdBus): VehiclePosition {
  return {
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
    sublinea: b.subline,
  };
}

function dedupeVehicles(list: VehiclePosition[]): VehiclePosition[] {
  const byId = new Map<string, VehiclePosition>();
  for (const v of list) {
    if (!byId.has(v.vehicleId)) byId.set(v.vehicleId, v);
  }
  return [...byId.values()];
}

/** Normaliza para comparar destinos sin acentos/mayúsculas. */
function norm(s: string): string {
  return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

export async function GET(req: NextRequest) {
  const lineId = req.nextUrl.searchParams.get("lineId") || undefined;
  const lineIdsParam = req.nextUrl.searchParams.get("lineIds");
  const lineIds = lineIdsParam ? lineIdsParam.split(",").filter(Boolean).slice(0, 20) : undefined;
  const stopId = req.nextUrl.searchParams.get("stopId");
  const dest = req.nextUrl.searchParams.get("dest"); // "que va a X" en vivo

  // ── Búsqueda "que va a X" (F2.3): todos los buses en vivo cuyo DESTINO matchea X.
  // Es lo que la gente ama: "a Pando" → solo los que van ahí, en tiempo real.
  if (dest && dest.trim().length >= 2) {
    try {
      if (!isMvdApiConfigured()) return NextResponse.json({ vehicles: [], dest, source: "no-api" });
      const q = norm(dest);
      const all = await getBuses({}).catch(() => [] as MvdBus[]);
      // Solo el DESTINO (a dónde VA el bus), no la subline (que incluye el origen:
      // "Pocitos - Paso de la Arena" matchearía "Pocitos" aunque vaya a Paso de la Arena).
      const matched = all
        .filter((b) => norm(b.destination).includes(q))
        .map(mvdBusToVehicle);
      return NextResponse.json(
        { vehicles: dedupeVehicles(matched), dest, count: matched.length, source: "dest-live" },
        { headers: { "Cache-Control": "no-store, max-age=0" } },
      );
    } catch {
      return NextResponse.json({ vehicles: [], dest, error: "API STM no disponible" }, { status: 200 });
    }
  }

  try {
    let vehicles: VehiclePosition[] = [];
    const sources: string[] = [];

    // Caso con parada: DEBE ser consistente con /api/stm/arrivals (si no, la lista
    // muestra buses "en vivo" que el mapa no puede trackear). Por eso:
    //   1. Fuente OFICIAL del STM (busstopId) → confiar (ya filtra dirección server-side).
    //   2. Fuente lejana (lines) → filtro GTFS estricto como red de seguridad.
    if (isMvdApiConfigured() && stopId && lineIds && lineIds.length > 0) {
      const ourLines = new Set(lineIds);
      const [upstream, allOfLines] = await Promise.all([
        getBuses({ busstopId: stopId }).catch(() => [] as MvdBus[]),
        getBuses({ lines: lineIds }).catch(() => [] as MvdBus[]),
      ]);
      const out: VehiclePosition[] = [];
      const seen = new Set<string>();

      // 1. Upstream oficial: confiar, PERO descartar los que el GTFS confirma que ya
      //    pasaron la parada (el filtro del STM a veces incluye pasados/sentido contrario).
      for (const b of upstream) {
        if (!ourLines.has(b.line)) continue;
        const v = mvdBusToVehicle(b);
        if (seen.has(v.vehicleId)) continue;
        if (busTowardsStopGtfs(v, stopId).reason === "passed") continue; // ya pasó → no trackear
        // Respaldo geométrico: descartar también los que quedaron más allá de la parada
        // aunque el GPS no haya snapeado (mismo bug del "estoy en la 160, está en la 162").
        if (busLikelyPassedStop({ lat: v.lat, lon: v.lon, lineName: v.lineName, destinoDesc: v.destinoDesc }, stopId)) continue;
        out.push(v); seen.add(v.vehicleId);
      }
      if (out.length > 0) sources.push("upstream");

      // 2. Lejanos no confirmados: filtro GTFS de dirección (evita sentido contrario).
      let far = 0;
      for (const b of allOfLines) {
        if (!ourLines.has(b.line)) continue;
        const v = mvdBusToVehicle(b);
        if (seen.has(v.vehicleId)) continue;
        if (busTowardsStopGtfs(v, stopId).goingTo) { out.push(v); seen.add(v.vehicleId); far++; }
      }
      if (far > 0) sources.push("gtfs-far");

      vehicles = out;
    }

    const hasStop = !!stopId;

    // Sin parada → todos los buses de las líneas pedidas
    if (!hasStop && vehicles.length === 0 && isMvdApiConfigured() && lineIds && lineIds.length > 0) {
      const buses = await getBuses({ lines: lineIds });
      if (buses.length > 0) {
        vehicles = buses.map(mvdBusToVehicle);
        sources.push("mvd-lines");
      }
    }

    // Fallback legacy — solo sin parada (con parada sería sin filtro de dirección)
    if (!hasStop && vehicles.length === 0) {
      vehicles = await getVehiclePositions(lineId, lineIds);
      if (vehicles.length > 0) sources.push("legacy");
    }

    vehicles = dedupeVehicles(vehicles);

    return NextResponse.json(
      { vehicles, updatedAt: Date.now(), source: sources.join("+") || "empty" },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (err) {
    console.error("[/api/stm/vehicles] error:", err);
    return NextResponse.json(
      { vehicles: [], updatedAt: Date.now(), error: "API STM no disponible" },
      { status: 200 }
    );
  }
}
