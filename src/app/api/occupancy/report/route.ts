import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

/**
 * POST /api/occupancy/report
 *
 * Proxy server-side para reportes de ocupación. El service role key nunca sale al
 * cliente y validamos el payload acá. La tabla `occupancy_reports` vive en Supabase
 * (ver supabase/schema.sql). Si no está configurado, responde 503 (la UI degrada a
 * invisible).
 *
 * ── Anti-troll en dos capas (in-memory, sin dependencias nuevas) ──────────────
 *   1. GLOBAL por IP: máx MAX_PER_WINDOW reportes por ventana. Frena el flood.
 *   2. DEDUP por (IP, línea, parada): 1 reporte por combinación por ventana. ESTA es
 *      la que protege el AGREGADO — el límite global por sí solo NO impide que una IP
 *      mande 5 veces "lleno" de la MISMA línea+parada e infle el promedio que ve todo
 *      el mundo. El dedup lo corta: un troll aislado aporta a lo sumo un reporte.
 *
 * El budget se consume SOLO tras un insert exitoso (rateLimitCommit va después del
 * insert): un guardado fallido o un 503 no debe bloquear el reintento legítimo.
 *
 * Límite conocido y aceptado: el estado vive en la memoria de la instancia serverless,
 * así que no se comparte entre instancias ni sobrevive a un cold start. Es una traba
 * real contra el troll casual (DevTools, repetir el POST) y contra el script ingenuo;
 * un atacante decidido que rote IPs/instancias necesitaría un store compartido, lo que
 * implicaría persistir la IP (PII que el proyecto evita) — fuera de alcance acá.
 */

const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_WINDOW = 5;

export interface RateState {
  count: number;
  resetAt: number;
}
export type RateStore = Map<string, RateState>;
export type RateReason = "global" | "duplicate";
export interface RateDecision {
  allowed: boolean;
  reason?: RateReason;
}

// Estado en memoria, por instancia de la función.
//   globalStore: budget por IP            → key = ip
//   dupStore:    marca por combinación    → key = `${ip}|${line}|${stopId}`
const globalStore: RateStore = new Map();
const dupStore: RateStore = new Map();

function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function dupKey(ip: string, line: string, stopId: string): string {
  return `${ip}|${line}|${stopId}`;
}

/**
 * Purga oportunista de entradas vencidas para que el Map no crezca sin límite dentro de
 * una instancia cálida. Solo se molesta si el store ya pasó un umbral.
 */
function purgeExpired(store: RateStore, now: number): void {
  if (store.size <= 500) return;
  for (const [k, e] of store) if (now >= e.resetAt) store.delete(k);
}

/**
 * Decisión de rate-limit PURA y de solo lectura (no muta los stores, reloj inyectado)
 * → determinística y testeable. Primero el dedup (más específico), después el global.
 */
export function rateLimitCheck(
  ip: string,
  line: string,
  stopId: string,
  now: number,
  global: RateStore,
  dup: RateStore,
  opts: { maxPerWindow?: number } = {},
): RateDecision {
  const maxPerWindow = opts.maxPerWindow ?? MAX_PER_WINDOW;

  // 1. Dedup por (IP, línea, parada): si hay marca vigente, es repetido.
  const dEntry = dup.get(dupKey(ip, line, stopId));
  if (dEntry && now < dEntry.resetAt) return { allowed: false, reason: "duplicate" };

  // 2. Global por IP: ¿le queda budget en la ventana?
  const gEntry = global.get(ip);
  if (gEntry && now < gEntry.resetAt && gEntry.count >= maxPerWindow) {
    return { allowed: false, reason: "global" };
  }

  return { allowed: true };
}

/**
 * Aplica el consumo de budget tras un reporte aceptado y guardado. Muta ambos stores:
 * incrementa/abre la ventana global de la IP y marca la combinación (IP, línea, parada).
 * Se llama SOLO si el insert salió bien.
 */
export function rateLimitCommit(
  ip: string,
  line: string,
  stopId: string,
  now: number,
  global: RateStore,
  dup: RateStore,
  opts: { windowMs?: number } = {},
): void {
  const windowMs = opts.windowMs ?? WINDOW_MS;
  purgeExpired(global, now);
  purgeExpired(dup, now);

  const gEntry = global.get(ip);
  if (!gEntry || now >= gEntry.resetAt) global.set(ip, { count: 1, resetAt: now + windowMs });
  else gEntry.count++;

  dup.set(dupKey(ip, line, stopId), { count: 1, resetAt: now + windowMs });
}

/** Valida y normaliza el payload. Devuelve el objeto tipado o null si es inválido. */
function validateOccupancyPayload(
  body: unknown,
): { line: string; stop_id: string; level: 1 | 2 | 3 } | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const { line, stop_id, level } = body as Record<string, unknown>;
  const lvl = Number(level);
  if (typeof line !== "string" || !line || line.length > 10) return null;
  if (typeof stop_id !== "string" || !stop_id || stop_id.length > 20) return null;
  if (![1, 2, 3].includes(lvl)) return null;
  return { line, stop_id, level: lvl as 1 | 2 | 3 };
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const valid = validateOccupancyPayload(body);
  if (!valid) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  // Rate-limit ANTES de tocar Supabase: rechazamos el spam sin gastar un insert.
  const ip = getIp(req);
  const decision = rateLimitCheck(ip, valid.line, valid.stop_id, Date.now(), globalStore, dupStore);
  if (!decision.allowed) {
    const message =
      decision.reason === "duplicate"
        ? "Ya nos pasaste esta línea recién. Con un reporte alcanza — probá otra o volvé en un rato."
        : "Pará un cachito: mandaste varios reportes seguidos. Seguí en unos minutos.";
    return NextResponse.json(
      { error: message },
      { status: 429, headers: { "Retry-After": String(Math.ceil(WINDOW_MS / 1000)) } },
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "No configurado" }, { status: 503 });
  }

  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await sb
    .from("occupancy_reports")
    .insert({ line: valid.line, stop_id: valid.stop_id, level: valid.level });

  if (error) {
    // No consumimos budget: un fallo del backend no debe bloquear el reintento.
    return NextResponse.json({ error: "Error al guardar" }, { status: 500 });
  }

  // Guardado OK → recién ahora consumimos el budget de la IP y marcamos la combinación.
  rateLimitCommit(ip, valid.line, valid.stop_id, Date.now(), globalStore, dupStore);

  return NextResponse.json({ ok: true });
}
