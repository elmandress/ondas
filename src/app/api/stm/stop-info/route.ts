import { NextRequest, NextResponse } from "next/server";
import { getStopVariants } from "@/lib/stm";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const stopId = req.nextUrl.searchParams.get("stopId");
  if (!stopId) {
    return NextResponse.json({ error: "stopId requerido" }, { status: 400 });
  }
  try {
    const info = await getStopVariants(stopId);
    return NextResponse.json(
      { info, updatedAt: Date.now() },
      { headers: { "Cache-Control": "public, max-age=300" } }
    );
  } catch {
    return NextResponse.json({ info: null, updatedAt: Date.now() });
  }
}
