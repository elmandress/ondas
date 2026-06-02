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
  /** El transbordo es entre dos variantes de la MISMA línea (183→183, recorrido
   *  que cambia). La UI lo aclara honestamente. */
  sameLineContinuation?: boolean;
  /** Ruta encadenada por paradas intermedias: nombres de los waypoints, en orden. */
  viaWaypoints?: string[];
}

export function useRoutePlanner(
  from: { lat: number; lon: number } | null,
  to: { lat: number; lon: number } | null,
  enabled = true,
  /** Hora de salida futura (ISO string). Si null/undefined → planifica para ahora. */
  departAt?: string | null,
  /** Paradas intermedias (hasta 3, en orden). Encadena O→W1→…→D. */
  waypoints?: Array<{ lat: number; lon: number; name?: string }>
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

    const ctrl = new AbortController();
    const timeoutId = setTimeout(() => ctrl.abort(), 15000);

    fetch("/api/route/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, departAt: departAt ?? undefined, waypoints: waypoints?.length ? waypoints : undefined }),
      signal: ctrl.signal,
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
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error && err.name === "AbortError" ? "Tiempo de espera agotado" : "Error de red");
        }
      })
      .finally(() => {
        clearTimeout(timeoutId);
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; ctrl.abort(); clearTimeout(timeoutId); };
    // waypoints: serializamos para que el effect reaccione a cambios de la lista.
  }, [from?.lat, from?.lon, to?.lat, to?.lon, enabled, departAt, waypoints?.map((w) => `${w.lat},${w.lon}`).join("|")]);

  return { routes, loading, error };
}
