/**
 * Hook para planificar rutas usando el endpoint GTFS-based.
 * SRS FR-4.
 */
"use client";

import { useEffect, useState } from "react";

export interface RouteLegDto {
  type: "walk" | "bus";
  fromStopId?: string;
  fromStopName?: string;
  toStopId?: string;
  toStopName?: string;
  lines?: string[];
  headsign?: string;
  numStops?: number;
  durationS: number;
  distanceM: number;
  polyline?: [number, number][];
  variantId?: string;
  /** Bus leg: la línea deja de operar dentro de los próximos ~45min */
  closingSoon?: boolean;
  /** Bus leg: minuto del día (0-1439) cuando deja de operar el bloque actual */
  endOfServiceMin?: number;
}

export interface PlannedRouteDto {
  totalSeconds: number;
  totalWalkM: number;
  numTransfers: number;
  legs: RouteLegDto[];
  signature: string;
  /** Cuántas variantes equivalentes existen (paradas o headsigns alternativos). */
  alternatives?: number;
}

export function useRoutePlanner(
  from: { lat: number; lon: number } | null,
  to: { lat: number; lon: number } | null,
  enabled = true
): {
  routes: PlannedRouteDto[];
  loading: boolean;
  error: string | null;
} {
  const [routes, setRoutes] = useState<PlannedRouteDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !from || !to) {
      setRoutes([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch("/api/route/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from, to }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) {
          setError(data.error);
          setRoutes([]);
        } else {
          setRoutes(data.routes || []);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Error de red");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [from?.lat, from?.lon, to?.lat, to?.lon, enabled]);

  return { routes, loading, error };
}
