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
    const latNum = parseFloat(lat);
    const lonNum = parseFloat(lon);
    if (!isFinite(latNum) || !isFinite(lonNum) || Math.abs(latNum) > 90 || Math.abs(lonNum) > 180) {
      return NextResponse.json({ error: "Coordenadas inválidas" }, { status: 400 });
    }
    const radNum = radius ? parseInt(radius) : 600;
    const stops = getNearbyStops(latNum, lonNum, isFinite(radNum) ? Math.min(radNum, 5000) : 600);
    return NextResponse.json({ stops });
  }

  return NextResponse.json({ error: "Parámetros insuficientes — usar ?q= o ?lat=&lon=" }, { status: 400 });
}
