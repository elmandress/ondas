"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Arrival } from "@/lib/stm";
import { adaptInterval } from "@/lib/network";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min — stale but better than nothing offline

function cacheKey(stopId: string) { return `ondas_arrivals_${stopId}`; }

function readCache(stopId: string): Arrival[] | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(stopId));
    if (!raw) return null;
    const { arrivals, ts } = JSON.parse(raw) as { arrivals: Arrival[]; ts: number };
    if (Date.now() - ts > CACHE_TTL_MS) return null;
    return arrivals;
  } catch { return null; }
}

function writeCache(stopId: string, arrivals: Arrival[]) {
  try { sessionStorage.setItem(cacheKey(stopId), JSON.stringify({ arrivals, ts: Date.now() })); }
  catch {}
}

export function useArrivals(stopId: string | null, intervalMs = 20000) {
  const [arrivals, setArrivals] = useState<Arrival[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [lastFetchFailed, setLastFetchFailed] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const fetchArrivals = useCallback(async () => {
    if (!stopId) {
      setArrivals([]);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/stm/arrivals?stopId=${encodeURIComponent(stopId)}`, {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const fresh = data.arrivals || [];
      setArrivals(fresh);
      writeCache(stopId, fresh);
      setLastUpdated(new Date());
      setLastFetchFailed(false);
      setIsOffline(false);
      setLoading(false);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      const offline = !navigator.onLine;
      if (offline) {
        const cached = readCache(stopId);
        if (cached) {
          setArrivals(cached);
          setIsOffline(true);
          setLastFetchFailed(false);
          setLoading(false);
          return;
        }
      }
      setError("No se pudieron cargar las llegadas");
      setLastFetchFailed(true);
      setIsOffline(offline);
      setLoading(false);
    }
  }, [stopId]);

  // Seed from cache immediately while the first fetch loads
  useEffect(() => {
    if (!stopId) { setArrivals([]); return; }
    const cached = readCache(stopId);
    if (cached) setArrivals(cached);
  }, [stopId]);

  useEffect(() => {
    fetchArrivals();
    if (!stopId) return;

    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer) clearInterval(timer);
      // Intervalo adaptado a la red: en celular / Data Saver refresca menos seguido.
      timer = setInterval(fetchArrivals, adaptInterval(intervalMs));
    };
    const stop = () => { if (timer) { clearInterval(timer); timer = null; } };

    // Pausar el polling cuando la app no está visible (no gastar datos de fondo);
    // al volver, refrescar de una y reanudar.
    const onVisibility = () => {
      if (document.hidden) stop();
      else { fetchArrivals(); start(); }
    };

    // Cambios de red reales en la calle (wifi→datos, recuperar señal en el subte/túnel):
    // al volver "online" refrescamos AL INSTANTE en vez de esperar hasta 20s al próximo
    // tick. Esto es lo que hace que se sienta viva caminando por la ciudad.
    const onOnline = () => { if (!document.hidden) { fetchArrivals(); start(); } };
    const onOffline = () => setIsOffline(true);

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      abortRef.current?.abort();
    };
  }, [fetchArrivals, stopId, intervalMs]);

  return { arrivals, loading, error, lastUpdated, lastFetchFailed, isOffline, refetch: fetchArrivals };
}
