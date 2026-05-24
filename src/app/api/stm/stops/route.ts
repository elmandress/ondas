import { NextRequest, NextResponse } from "next/server";
import { getNearbyStops, searchStops } from "@/lib/stm";

export async function GET(req: NextRequest) {
  const lat = req.nextUrl.searchParams.get("lat");
  const lon = req.nextUrl.searchParams.get("lon");
  const q = req.nextUrl.searchParams.get("q");
  const radius = req.nextUrl.searchParams.get("radius");

  if (q !== null) {
    const stops = searchStops(q);
    return NextResponse.json({ stops });
  }

  if (lat && lon) {
    const stops = getNearbyStops(
      parseFloat(lat),
      parseFloat(lon),
      radius ? parseInt(radius) : 600
    );
    return NextResponse.json({ stops });
  }

  return NextResponse.json({ error: "Parámetros insuficientes — usar ?q= o ?lat=&lon=" }, { status: 400 });
}
