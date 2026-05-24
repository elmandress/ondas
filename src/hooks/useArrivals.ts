"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Arrival } from "@/lib/stm";

export function useArrivals(stopId: string | null, intervalMs = 20000) {
  const [arrivals, setArrivals] = useState<Arrival[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchArrivals = useCallback(async () => {
    if (!stopId) {
      setArrivals([]);
      return;
    }

    // Cancelar fetch anterior
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
      setArrivals(data.arrivals || []);
      setLastUpdated(new Date());
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setError("No se pudieron cargar las llegadas");
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [stopId]);

  useEffect(() => {
    fetchArrivals();
    if (!stopId) return;
    const id = setInterval(fetchArrivals, intervalMs);
    return () => {
      clearInterval(id);
      abortRef.current?.abort();
    };
  }, [fetchArrivals, stopId, intervalMs]);

  return { arrivals, loading, error, lastUpdated, refetch: fetchArrivals };
}
