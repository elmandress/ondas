/**
 * GET /api/stm/variant-stops?line=76&destination=PUNTA+CARRETAS
 *
 * Devuelve TODAS las paradas que recorre un bondi (línea + destino), en orden,
 * con sus coordenadas. Permite mostrar la lista completa de paradas cuando el
 * usuario toca un bus en el mapa.
 *
 * SRS FR-5.4 (NUEVO): "tocar bondi → ver todas sus paradas".
 */
import { NextRequest, NextResponse } from "next/server";
import { findVariantForBus, getStopsForVariant } from "@/lib/gtfs-db";
import { findStopServer } from "@/lib/stops-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const line = req.nextUrl.searchParams.get("line");
  const destination = req.nextUrl.searchParams.get("destination") || "";

  if (!line) {
    return NextResponse.json({ error: "line requerido" }, { status: 400 });
  }

  const variant = findVariantForBus(line, destination);
  if (!variant) {
    return NextResponse.json({ stops: [], notFound: true, line, destination });
  }

  const variantStops = getStopsForVariant(variant.variantId);
  const enriched = variantStops
    .map((vs) => {
      const stop = findStopServer(vs.stopId);
      if (!stop) return null;
      return {
        stopId: vs.stopId,
        sequence: vs.sequence,
        arrivalSeconds: vs.arrivalSeconds,
        name: stop.stopName,
        code: stop.stopCode,
        lat: stop.stopLat,
        lon: stop.stopLon,
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  return NextResponse.json({
    line,
    destination,
    headsign: variant.headsign,
    variantId: variant.variantId,
    directionId: variant.directionId,
    stops: enriched,
    count: enriched.length,
  });
}
