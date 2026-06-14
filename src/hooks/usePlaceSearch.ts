"use client";

import { useState, useEffect, useRef } from "react";

/**
 * Búsqueda de lugares unificada (R68). Antes había TRES implementaciones del mismo
 * fetch+debounce+abort contra /api/geocode (SearchScreen, RouteScreen, RoutesManager) —
 * por eso el bug de caché de FASE 0 las rompió a las tres a la vez. Acá vive una sola.
 * Cada consumidor mapea `results` (GeoResult crudo de /api/geocode) a su forma local y
 * lo combina con su lógica de dominio (paradas, etc.) — esto es SOLO la parte de geocode.
 */
export interface GeoResult {
  id: string | number;
  name: string;
  fullName: string;
  lat: number;
  lon: number;
  type: string;
  class?: string;
  icon?: string;
  source?: "curated" | "nominatim";
}

/** Pura/testeable: ¿esta query vale la pena buscarla? (trim, 1–300 chars). */
export function isSearchableQuery(query: string): boolean {
  const t = query.trim();
  return t.length >= 1 && t.length <= 300;
}

export interface UsePlaceSearchOptions {
  /** Debounce del fetch (ms). Default 320. */
  debounceMs?: number;
  /** Si es false, no busca (útil cuando el input está cerrado/inactivo). */
  enabled?: boolean;
}

/**
 * Devuelve los lugares de /api/geocode para `query`, con debounce y cancelación de la
 * request anterior (AbortController). Degradable: ante error/abort devuelve [] sin tirar.
 */
export function usePlaceSearch(query: string, opts: UsePlaceSearchOptions = {}) {
  const debounceMs = opts.debounceMs ?? 320;
  const enabled = opts.enabled ?? true;
  const [results, setResults] = useState<GeoResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (debRef.current) clearTimeout(debRef.current);
    const q = query.trim();
    if (!enabled || !isSearchableQuery(q)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset al vaciar la query (mismo patrón legacy que el resto de los hooks de fetch)
      setResults([]);
      setLoading(false);
      abortRef.current?.abort();
      return;
    }
    setLoading(true);
    debRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        if (!res.ok) { setResults([]); setLoading(false); return; }
        const data = await res.json();
        setResults((data.results || []) as GeoResult[]);
        setLoading(false);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return; // request cancelada → ignorar
        setResults([]);
        setLoading(false);
      }
    }, debounceMs);

    return () => { if (debRef.current) clearTimeout(debRef.current); };
  }, [query, debounceMs, enabled]);

  return { results, loading };
}
