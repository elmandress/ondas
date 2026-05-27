import { NextRequest, NextResponse } from "next/server";
import { getScheduledArrivalsForStop, getTipoDia } from "@/lib/schedule-db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const stopId = req.nextUrl.searchParams.get("stop");
  if (!stopId) {
    return NextResponse.json({ error: "Missing stop param" }, { status: 400 });
  }

  const arrivals = getScheduledArrivalsForStop(stopId);
  const tipoDia = getTipoDia();
  const tipoDiaName = tipoDia === 1 ? "HABIL" : tipoDia === 2 ? "SABADO" : "DOMINGO";

  return NextResponse.json({
    stopId,
    tipoDia,
    tipoDiaName,
    count: arrivals.length,
    arrivals,
  });
}
