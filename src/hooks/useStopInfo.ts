"use client";

import { useState, useEffect } from "react";
import type { StopInfo } from "@/lib/stm";

/**
 * Caché compartido en memoria de stop-info (líneas reales de cada parada según API STM).
 * TTL: 10 minutos. Las paradas raramente cambian sus líneas dentro de una sesión.
 * In-flight dedupe: si dos componentes piden la misma parada al mismo tiempo,
 * se hace UNA sola request.
 */
const TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { info: StopInfo | null; ts: number }>();
const inflight = new Map<string, Promise<StopInfo | null>>();

function fetchStopInfo(stopId: string): Promise<StopInfo | null> {
  const cached = cache.get(stopId);
  if (cached && Date.now() - cached.ts < TTL_MS) return Promise.resolve(cached.info);

  const existing = inflight.get(stopId);
  if (existing) return existing;

  const promise = fetch(`/api/stm/stop-info?stopId=${encodeURIComponent(stopId)}`)
    .then((r) => (r.ok ? r.json() : { info: null }))
    .then((data: { info: StopInfo | null }) => {
      cache.set(stopId, { info: data.info, ts: Date.now() });
      inflight.delete(stopId);
      return data.info;
    })
    .catch(() => {
      inflight.delete(stopId);
      return null;
    });

  inflight.set(stopId, promise);
  return promise;
}

export function useStopInfo(stopId: string | null) {
  // Inicializadores lazy: leen la caché una sola vez al montar, no en cada render
  // (evita llamar Date.now() durante el render, que react-hooks marca como impuro).
  const [info, setInfo] = useState<StopInfo | null>(() => {
    const cachedNow = stopId ? cache.get(stopId) : undefined;
    return cachedNow && Date.now() - cachedNow.ts < TTL_MS ? cachedNow.info : null;
  });
  const [loading, setLoading] = useState(() => {
    const cachedNow = stopId ? cache.get(stopId) : undefined;
    const hasInitial = cachedNow && Date.now() - cachedNow.ts < TTL_MS;
    return !hasInitial && !!stopId;
  });

  useEffect(() => {
    if (!stopId) {
      setInfo(null);
      setLoading(false);
      return;
    }

    const cached = cache.get(stopId);
    if (cached && Date.now() - cached.ts < TTL_MS) {
      setInfo(cached.info);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    fetchStopInfo(stopId).then((result) => {
      if (cancelled) return;
      setInfo(result);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [stopId]);

  return { info, loading };
}

/** Permite a otros módulos consultar el cache sin disparar fetch. */
export function getStopInfoFromCache(stopId: string): StopInfo | null {
  const c = cache.get(stopId);
  return c && Date.now() - c.ts < TTL_MS ? c.info : null;
}

/** Pre-cargar varias paradas en background (útil para tarjetas de paradas cercanas). */
export function prefetchStopInfo(stopIds: string[]) {
  stopIds.forEach((id) => {
    const c = cache.get(id);
    if (!c || Date.now() - c.ts >= TTL_MS) fetchStopInfo(id);
  });
}
