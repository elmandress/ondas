/**
 * POST /api/route/plan
 * Body: { from: {lat,lon}, to: {lat,lon}, maxTransfers?: 0|1 }
 *
 * Devuelve rutas multimodales usando el GTFS oficial.
 * SRS FR-4.
 */
import { NextRequest, NextResponse } from "next/server";
import { planRoutesGtfs, planRoutesWithWaypoints, type WaypointPoint } from "@/lib/route-planner-gtfs";
import { isValidMvdCoord } from "@/lib/mvd-area";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { from, to, maxTransfers, departAt, waypoints } = body;

    // Una sola validación (finitud + bounds) para origen y destino. Rechaza NaN/Infinity.
    if (!from || !to || !isValidMvdCoord(from.lat, from.lon)) {
      return NextResponse.json({ error: "Origen fuera del área de Montevideo o inválido" }, { status: 400 });
    }
    if (!isValidMvdCoord(to.lat, to.lon)) {
      return NextResponse.json({ error: "Destino fuera del área de Montevideo o inválido" }, { status: 400 });
    }

    // departAt: ISO string (hora de salida). Parseable + no más de 24h en el pasado
    // (evita que una fecha 1970 use el día-de-semana incorrecto en los horarios).
    let departDate: Date | undefined;
    if (typeof departAt === "string") {
      const d = new Date(departAt);
      if (!isNaN(d.getTime()) && d.getTime() >= Date.now() - 24 * 60 * 60 * 1000) {
        departDate = d;
      }
    }

    // waypoints: hasta 3 paradas intermedias válidas (dentro del área), en orden.
    const wp: WaypointPoint[] = Array.isArray(waypoints)
      ? waypoints
          .filter((w: unknown): w is WaypointPoint =>
            !!w && isValidMvdCoord((w as WaypointPoint).lat, (w as WaypointPoint).lon))
          .slice(0, 3)
      : [];

    const opts = { maxTransfers: (maxTransfers === 0 ? 0 : 1) as 0 | 1, maxResults: 6, departAt: departDate };
    const routes = wp.length
      ? planRoutesWithWaypoints(from, wp, to, opts)
      : planRoutesGtfs(from, to, opts);

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
