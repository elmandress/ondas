import { NextRequest, NextResponse } from "next/server";
import { getArrivalsForStop, getMockArrivals } from "@/lib/stm";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const stopId = req.nextUrl.searchParams.get("stopId");
  if (!stopId) {
    return NextResponse.json({ error: "stopId requerido" }, { status: 400 });
  }

  try {
    const arrivals = await getArrivalsForStop(stopId);
    return NextResponse.json(
      { arrivals, stopId, updatedAt: Date.now() },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch {
    // Siempre retornamos algo — nunca pantalla en blanco
    return NextResponse.json({ arrivals: getMockArrivals(stopId), stopId, updatedAt: Date.now() });
  }
}
