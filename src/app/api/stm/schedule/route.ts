import { NextRequest, NextResponse } from "next/server";
import { getScheduledArrivalsForStop, getNextScheduledForLine, getTipoDia } from "@/lib/schedule-db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const stopId = req.nextUrl.searchParams.get("stop");
  if (!stopId) {
    return NextResponse.json({ error: "Missing stop param" }, { status: 400 });
  }

  const tipoDia = getTipoDia();
  const tipoDiaName = tipoDia === 1 ? "HABIL" : tipoDia === 2 ? "SABADO" : "DOMINGO";

  // Modo "pager" (estilo maprab): próximas N programadas de UNA línea en la parada.
  // Ej: /api/stm/schedule?stop=2055&line=183&limit=12
  const line = req.nextUrl.searchParams.get("line");
  if (line) {
    const limitRaw = Number(req.nextUrl.searchParams.get("limit"));
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 24) : 12;
    const arrivals = getNextScheduledForLine(stopId, line, limit);
    return NextResponse.json({
      stopId,
      line,
      tipoDia,
      tipoDiaName,
      count: arrivals.length,
      arrivals,
    });
  }

  const arrivals = getScheduledArrivalsForStop(stopId);

  return NextResponse.json({
    stopId,
    tipoDia,
    tipoDiaName,
    count: arrivals.length,
    arrivals,
  });
}
