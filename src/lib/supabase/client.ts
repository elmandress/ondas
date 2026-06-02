"use client";

/**
 * Cliente de Supabase para el NAVEGADOR (componentes "use client").
 *
 * Usa la anon/publishable key — es pública a propósito: viaja en el bundle y la
 * seguridad la da la RLS de schema.sql (cada quien ve/edita solo lo suyo). NUNCA
 * usar acá la service_role.
 *
 * Devuelve `null` si las env vars no están configuradas todavía: así toda la app
 * sigue andando con localStorage (sin cuenta) mientras Supabase no esté linkeado.
 * Quien lo use debe contemplar el null (ver isSupabaseEnabled).
 */
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** true si Supabase está configurado (hay URL + anon key). */
export function isSupabaseEnabled(): boolean {
  return Boolean(url && anonKey);
}

let _client: SupabaseClient | null = null;

/** Cliente singleton del navegador. null si Supabase no está configurado. */
export function getSupabaseBrowser(): SupabaseClient | null {
  if (!isSupabaseEnabled()) return null;
  if (_client) return _client;
  _client = createBrowserClient(url!, anonKey!);
  return _client;
}
