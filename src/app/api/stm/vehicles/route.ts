import { NextRequest, NextResponse } from "next/server";
import { getVehiclePositions, getMockVehicles } from "@/lib/stm";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const lineId = req.nextUrl.searchParams.get("lineId") || undefined;

  try {
    const vehicles = await getVehiclePositions(lineId);
    return NextResponse.json(
      { vehicles, updatedAt: Date.now() },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch {
    return NextResponse.json({ vehicles: getMockVehicles(), updatedAt: Date.now() });
  }
}
