import "server-only";

/**
 * Clientes de Supabase para el SERVIDOR (API routes / server components).
 *
 *  - getSupabaseServer(): cliente con la sesión del usuario (lee/escribe cookies).
 *    Respeta RLS → para operaciones "en nombre del usuario logueado".
 *  - getSupabaseAdmin(): cliente con service_role — BYPASSA RLS. SOLO para el
 *    pipeline que carga el catálogo y tareas de servidor de confianza. La key es
 *    secreta (env var server-only, scope Functions en Netlify). Jamás al cliente.
 *
 * Ambos devuelven null si faltan las env vars → la app degrada a modo sin-cuenta.
 */
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Cliente ligado a la sesión del request (cookies). En Next 16 `cookies()` es
 * async → esta función también lo es. Respeta RLS.
 */
export async function getSupabaseServer(): Promise<SupabaseClient | null> {
  if (!url || !anonKey) return null;
  const cookieStore = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // En route handlers/server actions se pueden escribir; en server
        // components puros Next lanza → lo envolvemos en try para no romper.
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          /* llamado desde un Server Component sin middleware de refresh: ignorar */
        }
      },
    },
  });
}

/**
 * Cliente ADMIN (service_role) — bypassa RLS. Solo servidor de confianza.
 * No persiste sesión ni toca cookies.
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
