"use client";

/**
 * Analytics ANÓNIMO y privacy-first. SIN trackers externos, SIN cookies, SIN PII.
 *
 * Coherente con el valor de "privacidad sin trackers" (vs PostHog de la competencia).
 * Solo registra eventos AGREGADOS (nombre + props no identificables) para saber qué
 * pantallas/acciones se usan — nunca quién las usa. La "sesión" es un id efímero en
 * memoria que muere al cerrar la pestaña; no identifica a la persona ni persiste.
 *
 * Degradable: si Supabase no está configurado, es un no-op. Best-effort (nunca bloquea
 * ni rompe la UI). Se puede desactivar del todo con localStorage cuando_no_analytics=1.
 */
import { getSupabaseBrowser } from "@/lib/supabase/client";

// Id de sesión efímero (en memoria, no localStorage) — muere al recargar/cerrar.
let _session: string | null = null;
function sessionId(): string {
  if (_session) return _session;
  _session = Math.random().toString(36).slice(2, 10);
  return _session;
}

function disabled(): boolean {
  if (typeof window === "undefined") return true;
  try { return localStorage.getItem("cuando_no_analytics") === "1"; } catch { return false; }
}

/** Registra un evento anónimo. props debe ser NO identificable (ej. {tab:"map"}). */
export function track(event: string, props: Record<string, string | number | boolean> = {}): void {
  if (disabled()) return;
  const sb = getSupabaseBrowser();
  if (!sb) return; // sin backend → no-op
  // Fire-and-forget; nunca esperamos ni rompemos por esto.
  void sb.from("analytics_events").insert({ event, props, session: sessionId() }).then(() => {}, () => {});
}
