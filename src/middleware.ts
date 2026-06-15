/**
 * Middleware: refresca la sesión de Supabase en cada request (patrón oficial de
 * @supabase/ssr para App Router). Sin esto, el access token expira y el usuario
 * "se desloguea" solo entre navegaciones.
 *
 * No-op si Supabase no está configurado (sin env vars) → la app sigue andando en
 * modo sin-cuenta exactamente como antes. Cero impacto mientras no se linkee.
 */
import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function middleware(request: NextRequest) {
  if (!url || !anonKey) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  // Tocar getUser() fuerza el refresh del token si hace falta y reescribe cookies.
  // R67: try/catch — si getUser() falla en el runtime de Netlify (Supabase Auth
  // inalcanzable desde el edge, cookie de sesión corrupta, etc.), SIN esto la
  // excepción tira TODA la request (incluida /api/stm/*) → 500 → el cliente muestra
  // "servidores del STM durmiendo" para vivo y programado a la vez. Degradamos con
  // gracia: seguimos sin sesión (la app anda en modo anónimo), nunca rompemos.
  try {
    await supabase.auth.getUser();
  } catch {
    /* sesión no refrescada este request — la app sigue andando sin cuenta */
  }
  return response;
}

export const config = {
  // R70 — SOLO el SPA (`/`). Antes el matcher corría sobre TODO (negative-lookahead):
  // las ~6,600 páginas SEO (/linea/*, /parada/*, /barrio/*, /a/*, /lineas…), todos los
  // /api/* y los sitemaps. Cada request pagaba un `supabase.auth.getUser()` (round-trip
  // de red a Supabase Auth) → TTFB ~2s medido en prod hasta en /linea/183 (SSG que debería
  // servirse del edge en ms). Y NADA server-side consume esa sesión: `getSupabaseServer()`
  // está definido pero nunca se llama; todo el auth/favoritos es CLIENTE (getSupabaseBrowser
  // en useAuth + sync-favorites), y el browser client auto-refresca su token. El refresh
  // server-side sólo es defendible en el SPA donde aterriza un usuario logueado por recarga
  // dura → matcher acotado a `/`. Esto saca el getUser() de las 6,600 SEO (la ventaja
  // competitiva #1, TTFB en cada resultado de Google) y de /api/* (baja la latencia de
  // arrivals + elimina el modo de falla 500 que el try/catch de R67 parchaba).
  matcher: ["/"],
};
