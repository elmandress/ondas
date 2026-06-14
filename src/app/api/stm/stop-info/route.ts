import { NextRequest, NextResponse } from "next/server";
import { getStopVariants } from "@/lib/stm";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const stopId = req.nextUrl.searchParams.get("stopId");
  if (!stopId || stopId.length > 30) {
    return NextResponse.json({ error: "stopId requerido" }, { status: 400 });
  }
  try {
    const info = await getStopVariants(stopId);
    // R67: `no-store` — la CDN Durable de Netlify no varía por `stopId` (Netlify-Vary
    // la ignora) → todas las paradas devolvían la info de la primera cacheada.
    return NextResponse.json(
      { info, updatedAt: Date.now() },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ info: null, updatedAt: Date.now() });
  }
}
