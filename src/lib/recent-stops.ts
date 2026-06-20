/**
 * Paradas consultadas recientemente — acceso rápido desde Home y Buscar sin re-buscar.
 * Mismo patrón pub/sub + localStorage que [[favorite-lines]] / favorite-stops, pero con
 * TTL: una parada que consultaste hace más de 7 días ya no es "reciente" (se limpia sola).
 *
 * Migración: el formato viejo era `string[]` (solo ids, sin timestamp, lo escribía
 * SearchScreen). Al leer lo toleramos (le damos `at` = ahora) → no se pierde el historial.
 * LOCAL-only, degradable: sin localStorage es no-op.
 */
"use client";

import { useSyncExternalStore } from "react";

export interface RecentStop {
  stopId: string;
  /** Timestamp de la última consulta (orden + TTL). */
  at: number;
}

const STORAGE_KEY = "ondas_stop_history";
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días
const MAX = 8;

function readFromStorage(): RecentStop[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const now = Date.now();
    const items: RecentStop[] = parsed
      // Migración del formato viejo (string[]) → {stopId, at}.
      .map((x: unknown) => (typeof x === "string" ? { stopId: x, at: now } : (x as RecentStop)))
      .filter((r) => r && typeof r.stopId === "string" && typeof r.at === "number");
    // TTL: descartar lo más viejo que 7 días.
    return items.filter((r) => now - r.at <= TTL_MS).slice(0, MAX);
  } catch {
    return [];
  }
}

function writeToStorage(items: RecentStop[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* localStorage lleno o deshabilitado: ignorar */
  }
}

let _cache: RecentStop[] | null = null;
const listeners = new Set<() => void>();
const SSR_SNAPSHOT: RecentStop[] = [];

function getCache(): RecentStop[] {
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

export function useRecentStops(): RecentStop[] {
  return useSyncExternalStore(subscribe, getCache, () => SSR_SNAPSHOT);
}

export function getRecentStops(): RecentStop[] {
  return getCache();
}

/** Registra (o re-ordena al frente) una parada consultada. */
export function pushRecentStop(stopId: string): void {
  if (!stopId) return;
  const items = getCache().filter((r) => r.stopId !== stopId);
  items.unshift({ stopId, at: Date.now() });
  writeToStorage(items.slice(0, MAX));
  notify();
}

export function clearRecentStops(): void {
  writeToStorage([]);
  notify();
}
