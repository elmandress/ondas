"use client";

import { useState, useEffect, useCallback } from "react";
import type { Arrival } from "@/lib/stm";

export function useArrivals(stopId: string | null, intervalMs = 20000) {
  const [arrivals, setArrivals] = useState<Arrival[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetch = useCallback(async () => {
    if (!stopId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await window.fetch(`/api/stm/arrivals?stopId=${stopId}`);
      const data = await res.json();
      setArrivals(data.arrivals || []);
      setLastUpdated(new Date());
    } catch {
      setError("No se pudieron cargar las llegadas");
    } finally {
      setLoading(false);
    }
  }, [stopId]);

  useEffect(() => {
    fetch();
    if (!stopId) return;
    const id = setInterval(fetch, intervalMs);
    return () => clearInterval(id);
  }, [fetch, stopId, intervalMs]);

  return { arrivals, loading, error, lastUpdated, refetch: fetch };
}
