/**
 * Store de paradas favoritas con localStorage + suscripción reactiva.
 * El usuario marca paradas con ★ desde el sheet de llegadas; aparecen en Inicio.
 *
 * Inspirado en lo que Matungos tiene desde 2023 (favoritos), pero más simple:
 * solo paradas, sin "rutas favoritas" complejas. Y persistencia automática
 * en localStorage (Matungos tuvo varios bugs de "se borran los favoritos").
 */
"use client";

import { useSyncExternalStore } from "react";

export interface FavoriteStop {
  stopId: string;
  stopCode: string;
  stopName: string;
  /** Líneas conocidas al momento de guardar (para mostrar en preview). */
  lines: string[];
  /** Alias opcional puesto por el usuario, ej "Casa", "Trabajo". */
  alias?: string;
  /** Timestamp de cuando se agregó (para ordenar por más reciente). */
  addedAt: number;
}

const STORAGE_KEY = "ondas_fav_stops";

function readFromStorage(): FavoriteStop[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeToStorage(items: FavoriteStop[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // localStorage lleno o deshabilitado: ignorar silenciosamente
  }
}

// Cache + suscripción
let _cache: FavoriteStop[] | null = null;
const listeners = new Set<() => void>();
const SSR_SNAPSHOT: FavoriteStop[] = [];

function getCache(): FavoriteStop[] {
  if (_cache === null) _cache = readFromStorage();
  return _cache;
}

function notify(): void {
  _cache = readFromStorage();
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function getSnapshot(): FavoriteStop[] {
  return getCache();
}
function getServerSnapshot(): FavoriteStop[] {
  return SSR_SNAPSHOT;
}

export function useFavoriteStops(): FavoriteStop[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function isFavorite(stopId: string): boolean {
  return getCache().some((f) => f.stopId === stopId);
}

export function addFavoriteStop(stop: Omit<FavoriteStop, "addedAt">): void {
  const items = getCache().filter((f) => f.stopId !== stop.stopId);
  items.unshift({ ...stop, addedAt: Date.now() });
  writeToStorage(items);
  notify();
  // Replicar a la nube si hay sesión (best-effort, no bloquea). Import dinámico
  // para no acoplar el store base a Supabase ni cargarlo si no hace falta.
  void import("@/lib/sync-favorites").then((m) => m.pushFavoriteToCloud(stop.stopId, stop.alias)).catch(() => {});
}

export function removeFavoriteStop(stopId: string): void {
  const items = getCache().filter((f) => f.stopId !== stopId);
  writeToStorage(items);
  notify();
  void import("@/lib/sync-favorites").then((m) => m.removeFavoriteFromCloud(stopId)).catch(() => {});
}

export function toggleFavoriteStop(stop: Omit<FavoriteStop, "addedAt">): boolean {
  if (isFavorite(stop.stopId)) {
    removeFavoriteStop(stop.stopId);
    return false;
  }
  addFavoriteStop(stop);
  return true;
}

export function setFavoriteAlias(stopId: string, alias: string | undefined): void {
  const clean = alias?.trim() || undefined;
  const items = getCache().map((f) =>
    f.stopId === stopId ? { ...f, alias: clean } : f
  );
  writeToStorage(items);
  notify();
  void import("@/lib/sync-favorites").then((m) => m.pushFavoriteToCloud(stopId, clean)).catch(() => {});
}

// ── Helpers internos para la sincronización con la nube (sync-favorites.ts) ──
// Prefijo "_" = no son API pública del store, solo los usa la capa de sync.

/** Snapshot crudo de los favoritos locales (sin reactividad). */
export function _getAllFavoritesRaw(): FavoriteStop[] {
  return getCache();
}

/** Fusiona favoritos venidos de la nube en local SIN re-empujarlos a la nube
 *  (evita el loop). Conserva los locales; agrega los que falten. */
export function _mergeFavoritesFromCloud(fromCloud: FavoriteStop[]): void {
  const existing = getCache();
  const haveIds = new Set(existing.map((f) => f.stopId));
  const merged = [...existing];
  for (const f of fromCloud) if (!haveIds.has(f.stopId)) merged.push(f);
  merged.sort((a, b) => b.addedAt - a.addedAt);
  writeToStorage(merged);
  notify();
}

/** Aliases especiales con icono dedicado en Inicio. */
export const SPECIAL_ALIASES = ["Casa", "Trabajo", "Facu"] as const;

/** Iconos para los aliases especiales. */
export function aliasIcon(alias: string | undefined): string {
  if (!alias) return "⭐";
  const norm = alias.trim().toLowerCase();
  if (norm === "casa") return "🏠";
  if (norm === "trabajo") return "💼";
  if (norm === "facu" || norm === "universidad" || norm === "facultad") return "🎓";
  if (norm === "gym" || norm === "gimnasio") return "🏋️";
  if (norm === "escuela" || norm === "liceo") return "🏫";
  return "⭐";
}
