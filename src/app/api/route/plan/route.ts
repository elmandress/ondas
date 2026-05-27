/**
 * POST /api/route/plan
 * Body: { from: {lat,lon}, to: {lat,lon}, maxTransfers?: 0|1 }
 *
 * Devuelve rutas multimodales usando el GTFS oficial.
 * SRS FR-4.
 */
import { NextRequest, NextResponse } from "next/server";
import { planRoutesGtfs } from "@/lib/route-planner-gtfs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { from, to, maxTransfers } = body;

    if (
      !from || !to ||
      typeof from.lat !== "number" || typeof from.lon !== "number" ||
      typeof to.lat !== "number" || typeof to.lon !== "number"
    ) {
      return NextResponse.json({ error: "from y to requeridos con lat/lon" }, { status: 400 });
    }

    // Validación: que estén en el área de MVD+metro
    if (from.lat > -34.6 || from.lat < -35.0 || from.lon > -55.8 || from.lon < -56.5) {
      return NextResponse.json({ error: "Origen fuera del área de Montevideo" }, { status: 400 });
    }
    if (to.lat > -34.6 || to.lat < -35.0 || to.lon > -55.8 || to.lon < -56.5) {
      return NextResponse.json({ error: "Destino fuera del área de Montevideo" }, { status: 400 });
    }

    const routes = planRoutesGtfs(from, to, {
      maxTransfers: maxTransfers === 0 ? 0 : 1,
      maxResults: 6,
    });

    return NextResponse.json({
      ok: true,
      from,
      to,
      routes,
      count: routes.length,
    });
  } catch (err) {
    console.error("[/api/route/plan] error:", err);
    return NextResponse.json({ error: "Error procesando ruta" }, { status: 500 });
  }
}
