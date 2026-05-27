/**
 * Hook para obtener pasos peatonales reales (calles) entre dos puntos.
 * Usa /api/walking (OSRM proxy) con cache compartido en módulo.
 *
 * SRS FR-4.3 + FR-4.9: pasos peatonales con nombres de calle reales.
 */
import { useEffect, useState } from "react";

export interface WalkingStep {
  distanceM: number;
  durationS: number;
  name: string;
  instruction: string;
}

export interface WalkingRoute {
  ok: boolean;
  distanceM: number;
  durationS: number;
  steps: WalkingStep[];
  source: "osrm" | "fallback";
}

interface CacheKey { from: [number, number]; to: [number, number]; }
const cache = new Map<string, WalkingRoute>();
const inflight = new Map<string, Promise<WalkingRoute | null>>();

function keyFor(k: CacheKey): string {
  // Redondeamos a ~10m de precisión para que clicks consecutivos pegen al cache
  const r = (n: number) => Math.round(n * 1e4) / 1e4;
  return `${r(k.from[0])},${r(k.from[1])}>${r(k.to[0])},${r(k.to[1])}`;
}

async function fetchWalking(from: [number, number], to: [number, number]): Promise<WalkingRoute | null> {
  const key = keyFor({ from, to });
  if (cache.has(key)) return cache.get(key)!;
  if (inflight.has(key)) return inflight.get(key)!;

  const p = fetch(`/api/walking?from=${from[0]},${from[1]}&to=${to[0]},${to[1]}`)
    .then((r) => (r.ok ? (r.json() as Promise<WalkingRoute>) : null))
    .then((data) => {
      inflight.delete(key);
      if (data && data.ok) cache.set(key, data);
      return data;
    })
    .catch(() => {
      inflight.delete(key);
      return null;
    });

  inflight.set(key, p);
  return p;
}

export function useWalkingSteps(
  from: { lat: number; lon: number } | null,
  to: { lat: number; lon: number } | null,
  enabled = true
): { route: WalkingRoute | null; loading: boolean } {
  const [route, setRoute] = useState<WalkingRoute | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !from || !to) {
      setRoute(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchWalking([from.lat, from.lon], [to.lat, to.lon]).then((r) => {
      if (!cancelled) {
        setRoute(r);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [from?.lat, from?.lon, to?.lat, to?.lon, enabled]);

  return { route, loading };
}
