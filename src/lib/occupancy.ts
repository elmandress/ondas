"use client";

import { getSupabaseBrowser } from "@/lib/supabase/client";

/**
 * Crowdsourcing de OCUPACIÓN del bus ("¿cómo viene?"). La gente reporta en 1 toque y
 * todos ven el dato agregado reciente → confianza y utilidad real ("no espero este que
 * viene reventado, tomo el próximo"). Es la idea fuerte de Maprab que nos faltaba.
 *
 * DISEÑO (clave):
 *  - 3 niveles, no más: 1=vacío (te sentás) · 2=normal · 3=lleno (vas apretado). Simple.
 *  - Pregunta solo cuando tiene sentido: en la parada, sobre los buses que ya llegaron/están.
 *  - Anti-spam: rate-limit local (1 reporte por línea+parada cada 15 min) + agregamos varios
 *    reportes (no mostramos uno suelto): un troll aislado se diluye. Anónimo (sesión efímera).
 *  - Degradable: si Supabase no está, es no-op (la UI no muestra el control). Nunca rompe.
 *
 * Requiere la tabla `occupancy_reports` (ver supabase/schema.sql). Si no existe, degrada.
 */

export type OccupancyLevel = 1 | 2 | 3;

export interface OccupancySummary {
  level: OccupancyLevel; // nivel predominante (redondeo del promedio)
  count: number;         // cuántos reportes recientes
  minutesAgo: number;    // hace cuánto el más reciente
}

const WINDOW_MIN = 45;          // ventana de reportes "recientes"
const RATELIMIT_MIN = 15;       // no repreguntar/reenviar la misma línea+parada
function rlKey(line: string, stopId: string) { return `cuando_occ_${line}_${stopId}`; }

/** ¿Ya reportó esta línea+parada hace poco? (evita spam y repreguntar). */
export function recentlyReported(line: string, stopId: string): boolean {
  try {
    const ts = Number(localStorage.getItem(rlKey(line, stopId)) || 0);
    return Date.now() - ts < RATELIMIT_MIN * 60_000;
  } catch { return false; }
}

/**
 * Reporta la ocupación de un bus. Pasa por el endpoint server-side que
 * valida y aplica rate-limit por IP (no directo a Supabase desde el cliente).
 * Fire-and-forget, degradable.
 */
export async function reportOccupancy(line: string, stopId: string, level: OccupancyLevel): Promise<boolean> {
  try {
    const res = await fetch("/api/occupancy/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ line, stop_id: String(stopId), level }),
    });
    if (!res.ok) return false;
    try { localStorage.setItem(rlKey(line, stopId), String(Date.now())); } catch { /* sin storage */ }
    return true;
  } catch { return false; }
}

/**
 * Ocupación agregada reciente por línea en una parada. Devuelve un mapa line→summary.
 * Solo incluye líneas con ≥1 reporte en la ventana. Degradable (vacío si no hay backend).
 */
export async function getRecentOccupancy(stopId: string, lines: string[]): Promise<Record<string, OccupancySummary>> {
  const sb = getSupabaseBrowser();
  if (!sb || lines.length === 0) return {};
  try {
    const sinceIso = new Date(Date.now() - WINDOW_MIN * 60_000).toISOString();
    const { data, error } = await sb
      .from("occupancy_reports")
      .select("line, level, created_at")
      .eq("stop_id", String(stopId))
      .gte("created_at", sinceIso)
      .in("line", lines)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error || !data) return {};
    const byLine: Record<string, { sum: number; n: number; latest: number }> = {};
    for (const r of data as Array<{ line: string; level: number; created_at: string }>) {
      const b = (byLine[r.line] ||= { sum: 0, n: 0, latest: 0 });
      b.sum += r.level; b.n += 1;
      b.latest = Math.max(b.latest, new Date(r.created_at).getTime());
    }
    const out: Record<string, OccupancySummary> = {};
    for (const [line, b] of Object.entries(byLine)) {
      out[line] = {
        level: Math.round(b.sum / b.n) as OccupancyLevel,
        count: b.n,
        minutesAgo: Math.max(0, Math.round((Date.now() - b.latest) / 60_000)),
      };
    }
    return out;
  } catch { return {}; }
}

export function occupancyLabel(level: OccupancyLevel): { text: string; emoji: string } {
  switch (level) {
    case 1: return { text: "venía vacío", emoji: "🟢" };
    case 2: return { text: "venía normal", emoji: "🟡" };
    case 3: return { text: "venía lleno", emoji: "🔴" };
  }
}
