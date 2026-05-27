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
import { busTowardsStopGtfs } from "@/lib/bus-direction-gtfs";

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

export async function GET(req: NextRequest) {
  const lineId = req.nextUrl.searchParams.get("lineId") || undefined;
  const lineIdsParam = req.nextUrl.searchParams.get("lineIds");
  const lineIds = lineIdsParam ? lineIdsParam.split(",").filter(Boolean) : undefined;
  const stopId = req.nextUrl.searchParams.get("stopId");

  try {
    let vehicles: VehiclePosition[] = [];
    const sources: string[] = [];

    // Caso con parada: filtro GTFS estricto (variante + ordinal)
    if (isMvdApiConfigured() && stopId && lineIds && lineIds.length > 0) {
      const buses = await getBuses({ lines: lineIds }).catch(() => [] as MvdBus[]);
      const filtered: VehiclePosition[] = [];
      for (const b of buses) {
        const v = mvdBusToVehicle(b);
        const check = busTowardsStopGtfs(v, stopId);
        if (check.goingTo) filtered.push(v);
      }
      vehicles = filtered;
      if (filtered.length > 0) sources.push("gtfs-filtered");
    }

    // Sin parada → todos los buses de las líneas pedidas
    if (vehicles.length === 0 && isMvdApiConfigured() && lineIds && lineIds.length > 0) {
      const buses = await getBuses({ lines: lineIds });
      if (buses.length > 0) {
        vehicles = buses.map(mvdBusToVehicle);
        sources.push("mvd-lines");
      }
    }

    // Fallback legacy
    if (vehicles.length === 0) {
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
