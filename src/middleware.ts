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
  await supabase.auth.getUser();
  return response;
}

export const config = {
  // Corre en todo menos assets estáticos y los .json/.db de datos (no necesitan sesión).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons/|manifest.json|.*\\.(?:json|db|png|jpg|jpeg|svg|webp)$).*)",
  ],
};
