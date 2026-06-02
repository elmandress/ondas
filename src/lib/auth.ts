"use client";

/**
 * Auth con Supabase — degradable. Si Supabase no está configurado, `useAuth`
 * devuelve {enabled:false, user:null} y la app funciona en modo sin-cuenta
 * (favoritos/rutas en localStorage, como siempre).
 *
 * Cuando SÍ está, expone el usuario actual (reactivo vía onAuthStateChange) y
 * helpers de login (magic link por email) / logout. Sin contraseñas: magic link
 * es lo más simple y seguro para una PWA de transporte (coherente con
 * "sin cuenta, sin login" como default y cuenta opcional para sincronizar).
 */
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowser, isSupabaseEnabled } from "@/lib/supabase/client";

export interface AuthState {
  enabled: boolean;       // ¿Supabase configurado?
  loading: boolean;       // ¿todavía resolviendo la sesión inicial?
  user: User | null;
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    enabled: isSupabaseEnabled(),
    loading: isSupabaseEnabled(),
    user: null,
  });

  useEffect(() => {
    const sb = getSupabaseBrowser();
    if (!sb) {
      setState({ enabled: false, loading: false, user: null });
      return;
    }
    let active = true;
    sb.auth.getUser().then(({ data }) => {
      if (!active) return;
      setState({ enabled: true, loading: false, user: data.user ?? null });
      if (data.user) void import("@/lib/sync-favorites").then((m) => m.syncFavoritesOnLogin()).catch(() => {});
    });
    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      setState({ enabled: true, loading: false, user: session?.user ?? null });
      // Al iniciar sesión, fusionar favoritos local↔nube.
      if (event === "SIGNED_IN" && session?.user) {
        void import("@/lib/sync-favorites").then((m) => m.syncFavoritesOnLogin()).catch(() => {});
      }
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);

  return state;
}

/** Envía el magic link de inicio de sesión al email. */
export async function signInWithEmail(email: string): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabaseBrowser();
  if (!sb) return { ok: false, error: "Las cuentas no están disponibles todavía." };
  const emailRedirectTo = typeof window !== "undefined" ? `${window.location.origin}` : undefined;
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo } });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function signOut(): Promise<void> {
  const sb = getSupabaseBrowser();
  if (sb) await sb.auth.signOut();
}
