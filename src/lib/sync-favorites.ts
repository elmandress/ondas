"use client";

/**
 * Sincronización de paradas favoritas con Supabase cuando hay sesión.
 *
 * Modelo "local-first": localStorage sigue siendo la caché que usa la UI (rápida,
 * funciona sin conexión y sin cuenta). Supabase es el respaldo en la nube que
 * sigue al usuario entre dispositivos. Al loguearse:
 *   1) MERGE: subimos los favoritos locales que no estén en la nube (upsert).
 *   2) PULL: bajamos los de la nube y los fusionamos en local.
 * A partir de ahí, cada alta/baja local se replica a la nube (best-effort: si
 * falla la red, local no se rompe).
 *
 * Esto NO cambia el contrato de favorite-stops.ts: si no hay sesión o Supabase no
 * está, todo se comporta exactamente como antes.
 */
import { getSupabaseBrowser } from "@/lib/supabase/client";
import {
  type FavoriteStop,
  _getAllFavoritesRaw,
  _mergeFavoritesFromCloud,
} from "@/lib/favorite-stops";

// Fila de la tabla public.favorite_stops (subset que usamos).
interface FavRow {
  stop_id: string;
  alias: string | null;
  created_at: string;
}

let syncing = false;

/** Llamar al loguearse (o al cargar con sesión activa). Hace merge bidireccional. */
export async function syncFavoritesOnLogin(): Promise<void> {
  const sb = getSupabaseBrowser();
  if (!sb || syncing) return;
  const { data: auth } = await sb.auth.getUser();
  const user = auth.user;
  if (!user) return;

  syncing = true;
  try {
    const local = _getAllFavoritesRaw();

    // 1) PULL nube
    const { data: cloud, error } = await sb
      .from("favorite_stops")
      .select("stop_id, alias, created_at");
    if (error) return; // si falla, no tocamos local

    const cloudRows = (cloud ?? []) as FavRow[];
    const cloudIds = new Set(cloudRows.map((r) => r.stop_id));

    // 2) PUSH lo local que falta en la nube (las paradas deben existir en
    //    public.stops; si una no está aún en el catálogo, el upsert la ignora
    //    por la FK → no rompe, solo no sube esa).
    const toPush = local.filter((f) => !cloudIds.has(f.stopId));
    if (toPush.length) {
      await sb.from("favorite_stops").upsert(
        toPush.map((f) => ({ user_id: user.id, stop_id: f.stopId, alias: f.alias ?? null })),
        { onConflict: "user_id,stop_id", ignoreDuplicates: true },
      );
    }

    // 3) MERGE lo de la nube en local (las locales se conservan).
    const localIds = new Set(local.map((f) => f.stopId));
    const fromCloud: FavoriteStop[] = cloudRows
      .filter((r) => !localIds.has(r.stop_id))
      .map((r) => ({
        stopId: r.stop_id,
        stopCode: r.stop_id,
        stopName: r.stop_id, // el nombre real lo completa la UI con el dataset de paradas
        lines: [],
        alias: r.alias ?? undefined,
        addedAt: new Date(r.created_at).getTime() || Date.now(),
      }));
    if (fromCloud.length) _mergeFavoritesFromCloud(fromCloud);
  } finally {
    syncing = false;
  }
}

/** Replica un alta a la nube (best-effort). No-op sin sesión/Supabase. */
export async function pushFavoriteToCloud(stopId: string, alias?: string): Promise<void> {
  const sb = getSupabaseBrowser();
  if (!sb) return;
  const { data } = await sb.auth.getUser();
  if (!data.user) return;
  await sb.from("favorite_stops").upsert(
    { user_id: data.user.id, stop_id: stopId, alias: alias ?? null },
    { onConflict: "user_id,stop_id" },
  ).then(() => {}, () => {}); // tragar errores de red
}

/** Replica una baja a la nube (best-effort). */
export async function removeFavoriteFromCloud(stopId: string): Promise<void> {
  const sb = getSupabaseBrowser();
  if (!sb) return;
  const { data } = await sb.auth.getUser();
  if (!data.user) return;
  await sb.from("favorite_stops").delete()
    .eq("user_id", data.user.id).eq("stop_id", stopId)
    .then(() => {}, () => {});
}
