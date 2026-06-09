"use client";

import { useState, useEffect } from "react";
import type { VehiclePosition } from "@/lib/stm";
import { adaptInterval } from "@/lib/network";

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
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Key estable para el effect (evita re-render por nuevo array con mismos elementos)
  const filterKey = lineIds && lineIds.length > 0 ? [...lineIds].sort().join(",") : "";

  useEffect(() => {
    if (!enabled) {
      setVehicles([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    let controller: AbortController | null = null;
    // Si tenemos stopId + lineIds, el server usa la API autenticada con filtro upstream oficial
    const params = new URLSearchParams();
    if (filterKey) params.set("lineIds", filterKey);
    if (stopId) params.set("stopId", stopId);
    const url = "/api/stm/vehicles" + (params.toString() ? "?" + params.toString() : "");

    const load = () => {
      controller?.abort();
      controller = new AbortController();
      setLoading(true);
      fetch(url, { signal: controller.signal })
        .then((r) => (r.ok ? r.json() : { vehicles: [] }))
        .then((d) => {
          if (cancelled) return;
          setVehicles(d.vehicles || []);
          setLastUpdated(new Date());
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };

    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer) clearInterval(timer);
      // Buses en vivo es el polling más pesado: en celular/Data Saver lo espaciamos.
      timer = setInterval(load, adaptInterval(intervalMs));
    };
    const stopTimer = () => { if (timer) { clearInterval(timer); timer = null; } };

    // Pausar cuando la app no está visible (no quemar datos de fondo); al volver, refrescar.
    const onVisibility = () => {
      if (document.hidden) stopTimer();
      else { load(); start(); }
    };
    // Al recuperar señal en la calle, refrescar los buses al instante (no esperar al tick).
    const onOnline = () => { if (!document.hidden) { load(); start(); } };

    load();
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    return () => {
      cancelled = true;
      controller?.abort();
      stopTimer();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
    };
  }, [enabled, intervalMs, filterKey, stopId]);

  return { vehicles, loading, lastUpdated };
}
