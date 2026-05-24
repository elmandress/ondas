import { NextRequest, NextResponse } from "next/server";
import { getNearbyStops, searchStops } from "@/lib/stm";

export async function GET(req: NextRequest) {
  const lat = req.nextUrl.searchParams.get("lat");
  const lon = req.nextUrl.searchParams.get("lon");
  const q = req.nextUrl.searchParams.get("q");

  try {
    if (q) {
      const stops = await searchStops(q);
      return NextResponse.json({ stops });
    }
    if (lat && lon) {
      const stops = await getNearbyStops(parseFloat(lat), parseFloat(lon));
      return NextResponse.json({ stops });
    }
    return NextResponse.json({ error: "Parámetros insuficientes" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Error al obtener paradas" }, { status: 500 });
  }
}
