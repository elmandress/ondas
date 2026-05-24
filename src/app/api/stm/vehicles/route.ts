import { NextRequest, NextResponse } from "next/server";
import { getVehiclePositions } from "@/lib/stm";

export async function GET(req: NextRequest) {
  const lineId = req.nextUrl.searchParams.get("lineId") || undefined;

  try {
    const vehicles = await getVehiclePositions(lineId);
    return NextResponse.json({ vehicles }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Error al obtener vehículos" }, { status: 500 });
  }
}
