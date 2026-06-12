/**
 * Hook que dado (stopId, lineName) devuelve la ETA del próximo bus de esa línea.
 * Usado por RouteScreen y panel de ruta del mapa para mostrar "Próximo en X min"
 * al lado de cada leg de bus.
 *
 * SRS FR-4.4.
 */
import { useEffect, useState } from "react";
import { sameLine } from "@/lib/line-name";

interface ArrivalLite {
  lineName: string;
  eta: number;
  realtime?: boolean;
}

/**
 * Cache compartido en módulo para no spamear la API.
 * Una sola llamada por (stopId, ttl=30s) atiende a múltiples consumidores.
 */
interface CacheEntry { arrivals: ArrivalLite[]; expiresAt: number; }
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<ArrivalLite[]>>();

const TTL_MS = 25_000;

async function fetchArrivals(stopId: string): Promise<ArrivalLite[]> {
  const now = Date.now();
  const cached = cache.get(stopId);
  if (cached && cached.expiresAt > now) return cached.arrivals;

  if (inflight.has(stopId)) return inflight.get(stopId)!;

  const p = fetch(`/api/stm/arrivals?stopId=${encodeURIComponent(stopId)}`)
    .then((r) => (r.ok ? r.json() : { arrivals: [] }))
    .then((d) => {
      const arrivals = (d.arrivals || []) as ArrivalLite[];
      cache.set(stopId, { arrivals, expiresAt: Date.now() + TTL_MS });
      inflight.delete(stopId);
      return arrivals;
    })
    .catch(() => {
      inflight.delete(stopId);
      return [];
    });

  inflight.set(stopId, p);
  return p;
}

export interface NextArrivalInfo {
  /** ETA en minutos del próximo bus de esa línea en esa parada. null si no hay. */
  etaMin: number | null;
  /** true si proviene de GPS/upcoming en vivo, false si es horario programado. */
  realtime: boolean;
  loading: boolean;
}

export function useNextArrivalForLine(
  stopId: string | null | undefined,
  lineName: string | null | undefined
): NextArrivalInfo {
  const [state, setState] = useState<NextArrivalInfo>({ etaMin: null, realtime: false, loading: false });

  useEffect(() => {
    if (!stopId || !lineName) {
      setState({ etaMin: null, realtime: false, loading: false });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));

    fetchArrivals(stopId).then((arrivals) => {
      if (cancelled) return;
      // Canónico: el planner usa la grafía GTFS ("Ce1") y las llegadas en vivo la del
      // GPS ("CE1") — comparar con === dejaba esas líneas sin "Próximo en X min" (R57).
      const matches = arrivals.filter((a) => sameLine(a.lineName, lineName));
      if (matches.length === 0) {
        setState({ etaMin: null, realtime: false, loading: false });
      } else {
        const first = matches[0];
        setState({ etaMin: first.eta, realtime: !!first.realtime, loading: false });
      }
    });

    return () => { cancelled = true; };
  }, [stopId, lineName]);

  return state;
}
