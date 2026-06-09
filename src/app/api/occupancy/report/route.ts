import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

/**
 * POST /api/occupancy/report
 *
 * Proxy server-side para reportes de ocupación. Agrega:
 *  - Validación estricta de inputs
 *  - Rate-limit por IP: máx 5 reportes / 15 min (in-memory, resetea con el proceso)
 *  - El service role key nunca sale al cliente
 *
 * La tabla `occupancy_reports` vive en Supabase (ver supabase/schema.sql).
 * Si no está configurado, responde 503 (la UI degrada a invisible).
 */

const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_WINDOW = 5;

interface RateLimitEntry { count: number; resetAt: number; }
const ipMap = new Map<string, RateLimitEntry>();

function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function allowRequest(ip: string): boolean {
  const now = Date.now();
  // Cleanup oportunístico: purgar entradas expiradas en cada request para que el
  // Map no crezca sin límite dentro de una instancia cálida de la función.
  if (ipMap.size > 500) {
    for (const [k, e] of ipMap) if (now >= e.resetAt) ipMap.delete(k);
  }
  const entry = ipMap.get(ip);
  if (!entry || now >= entry.resetAt) {
    ipMap.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_PER_WINDOW) return false;
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  const ip = getIp(req);
  if (!allowRequest(ip)) {
    return NextResponse.json(
      { error: "Demasiados reportes. Esperá un momento." },
      { status: 429 },
    );
  }

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }); }

  const { line, stop_id, level } = (body ?? {}) as Record<string, unknown>;
  const lvl = Number(level);

  if (
    typeof line !== "string" || !line || line.length > 10 ||
    typeof stop_id !== "string" || !stop_id || stop_id.length > 20 ||
    ![1, 2, 3].includes(lvl)
  ) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "No configurado" }, { status: 503 });
  }

  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await sb
    .from("occupancy_reports")
    .insert({ line, stop_id, level: lvl });

  if (error) {
    return NextResponse.json({ error: "Error al guardar" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
