import { NextRequest, NextResponse } from "next/server";
import { getArrivals } from "@/lib/stm";

export async function GET(req: NextRequest) {
  const stopId = req.nextUrl.searchParams.get("stopId");
  if (!stopId) {
    return NextResponse.json({ error: "stopId requerido" }, { status: 400 });
  }

  try {
    const arrivals = await getArrivals(stopId);
    return NextResponse.json({ arrivals }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: "Error al obtener llegadas" }, { status: 500 });
  }
}
