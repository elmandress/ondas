"use client";

import { useState, useEffect, useRef } from "react";
import type { VehiclePosition } from "@/lib/stm";

/**
 * Hook de buses en vivo (stm-online).
 * - `enabled=false` (default): NO hace polling, devuelve [].
 * - `lineIds`: filtra server-side por esas líneas (pasa array a la API).
 */
export function useVehicles(
  intervalMs = 10000,
  options: { enabled?: boolean; lineIds?: string[]; stopId?: string | null } = {}
) {
  const { enabled = false, lineIds, stopId } = options;
  const [vehicles, setVehicles] = useState<VehiclePosition[]>([]);
  const [loading, setLoading] = useState(false);
  const lastUpdateRef = useRef<Date | null>(null);

  // Key estable para el effect (evita re-render por nuevo array con mismos elementos)
  const filterKey = lineIds && lineIds.length > 0 ? [...lineIds].sort().join(",") : "";

  useEffect(() => {
    if (!enabled) {
      setVehicles([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    // Si tenemos stopId + lineIds, el server usa la API autenticada con filtro upstream oficial
    const params = new URLSearchParams();
    if (filterKey) params.set("lineIds", filterKey);
    if (stopId) params.set("stopId", stopId);
    const url = "/api/stm/vehicles" + (params.toString() ? "?" + params.toString() : "");

    const load = () => {
      setLoading(true);
      fetch(url)
        .then((r) => (r.ok ? r.json() : { vehicles: [] }))
        .then((d) => {
          if (cancelled) return;
          setVehicles(d.vehicles || []);
          lastUpdateRef.current = new Date();
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };

    load();
    const id = setInterval(load, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [enabled, intervalMs, filterKey, stopId]);

  return { vehicles, loading, lastUpdated: lastUpdateRef.current };
}
