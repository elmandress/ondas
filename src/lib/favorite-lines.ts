/**
 * Líneas favoritas (R71) — "¿cuándo pasa el 121?" en un toque. Apalanca las páginas
 * /linea/[x] (la ventaja SEO del proyecto) y el LineDetailSheet ya existentes: marcás la
 * línea con ★ y aparece en Inicio → tap → recorrido + horarios.
 *
 * Mismo patrón pub/sub + localStorage que favorite-stops, pero más simple: solo el número
 * de línea, sin alias. LOCAL-only (no cloud): el schema de Supabase de favoritos es por
 * parada; sincronizar líneas sería un cambio de schema aparte. Degradable: si no hay
 * localStorage, es no-op (no rompe).
 */
"use client";

import { useSyncExternalStore } from "react";

export interface FavoriteLine {
  line: string;
  /** Timestamp de alta (orden por más reciente). */
  addedAt: number;
}

const STORAGE_KEY = "ondas_fav_lines";

function readFromStorage(): FavoriteLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((f) => f && typeof f.line === "string") : [];
  } catch {
    return [];
  }
}

function writeToStorage(items: FavoriteLine[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* localStorage lleno o deshabilitado: ignorar */
  }
}

let _cache: FavoriteLine[] | null = null;
const listeners = new Set<() => void>();
const SSR_SNAPSHOT: FavoriteLine[] = [];

function getCache(): FavoriteLine[] {
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

export function useFavoriteLines(): FavoriteLine[] {
  return useSyncExternalStore(subscribe, getCache, () => SSR_SNAPSHOT);
}

export function isFavoriteLine(line: string): boolean {
  return getCache().some((f) => f.line === line);
}

export function addFavoriteLine(line: string): void {
  if (!line) return;
  const items = getCache().filter((f) => f.line !== line);
  items.unshift({ line, addedAt: Date.now() });
  writeToStorage(items);
  notify();
}

export function removeFavoriteLine(line: string): void {
  writeToStorage(getCache().filter((f) => f.line !== line));
  notify();
}

/** Alterna; devuelve true si quedó marcada como favorita. */
export function toggleFavoriteLine(line: string): boolean {
  if (isFavoriteLine(line)) {
    removeFavoriteLine(line);
    return false;
  }
  addFavoriteLine(line);
  return true;
}
