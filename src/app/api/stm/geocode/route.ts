import { NextRequest, NextResponse } from "next/server";
import { geocodeAddress } from "@/lib/stm";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  if (!q?.trim() || q.length > 200) {
    return NextResponse.json({ results: [] });
  }
  try {
    const results = await geocodeAddress(q);
    // R67: `no-store` — la CDN Durable de Netlify no varía por `q` (Netlify-Vary la
    // ignora) → colapsaba todas las búsquedas en una sola entrada cacheada.
    return NextResponse.json({ results }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
