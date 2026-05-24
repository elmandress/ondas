import { NextRequest, NextResponse } from "next/server";
import { geocodeAddress } from "@/lib/stm";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  if (!q?.trim()) {
    return NextResponse.json({ results: [] });
  }
  try {
    const results = await geocodeAddress(q);
    return NextResponse.json({ results }, { headers: { "Cache-Control": "public, s-maxage=300" } });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
