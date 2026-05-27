/**
 * Enriquecimiento de los walk legs de una ruta con polylines reales por calles (OSRM).
 *
 * El planner GTFS devuelve walk legs con polyline = [origen, destino] (línea recta).
 * Este hook hace fetch a /api/walking para cada walk leg y reemplaza la polyline
 * con el camino REAL por calles. Mientras carga, mantiene la línea recta como placeholder.
 *
 * Server-friendly: cache compartido en módulo, sin re-fetch si las mismas coords ya están.
 */
import { useEffect, useState } from "react";
import type { PlannedRouteDto, RouteLegDto } from "@/hooks/useRouteplanner";

interface WalkingApiResult {
  ok: boolean;
  steps?: { distanceM: number; durationS: number; instruction: string }[];
  source?: string;
}

const cache = new Map<string, [number, number][]>();
const inflight = new Map<string, Promise<[number, number][] | null>>();

function keyFor(from: [number, number], to: [number, number]): string {
  const r = (n: number) => Math.round(n * 1e4) / 1e4;
  return `${r(from[0])},${r(from[1])}>${r(to[0])},${r(to[1])}`;
}

/**
 * Fetch OSRM con geometría completa (no solo steps). El endpoint /api/walking
 * actual solo devuelve steps — pero OSRM público devuelve también geometry.
 * Hacemos fetch directo a OSRM aquí para tener las coords del path.
 */
// Distancia haversine entre 2 puntos (metros)
function haversineM(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

// Largo total de una polyline (suma haversine entre puntos consecutivos)
function polylineLengthM(coords: [number, number][]): number {
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    total += haversineM(coords[i - 1], coords[i]);
  }
  return total;
}
// Helper marcado como usado (sirve a fetchOneWay vía best-of-two)
void haversineM;

/**
 * Pide a OSRM las dos opciones: ida y vuelta, y nos quedamos con la MÁS CORTA.
 *
 * Razón: OSRM público respeta sentidos de calle también para `foot` (bug
 * conocido — el perfil no excluye `oneway=*`). Si una calle es de mano única,
 * el motor hace que el peatón "dé toda la vuelta a la manzana", lo cual es
 * absurdo: caminando NO existen los sentidos.
 *
 * Workaround: para cada walk leg pedimos A→B y B→A en paralelo y elegimos
 * la geometría más corta (en metros). Si ambos paths son razonables, OSRM
 * devuelve el mismo recorrido en ambos sentidos. Si una dirección está
 * "bloqueada" por oneway, la otra suele ir directo.
 *
 * El path elegido se invierte si era B→A para mantener orientación coherente.
 */
async function fetchOneWay(from: [number, number], to: [number, number]): Promise<[number, number][] | null> {
  // Coords OSRM: lon,lat. Usamos `walking` (más permisivo que `foot` con oneway).
  const url = `https://router.project-osrm.org/route/v1/walking/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`;
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const data = await r.json() as { routes?: { geometry: { coordinates: [number, number][] } }[] };
    const geo = data.routes?.[0]?.geometry?.coordinates;
    if (!geo) return null;
    return geo.map(([lon, lat]) => [lat, lon]);
  } catch {
    return null;
  }
}

async function fetchWalkingPolyline(from: [number, number], to: [number, number]): Promise<[number, number][] | null> {
  const key = keyFor(from, to);
  if (cache.has(key)) return cache.get(key)!;
  if (inflight.has(key)) return inflight.get(key)!;

  const p = (async () => {
    const [forward, reverse] = await Promise.all([
      fetchOneWay(from, to),
      fetchOneWay(to, from),
    ]);
    let best: [number, number][] | null = null;
    let bestLen = Infinity;
    if (forward) {
      const len = polylineLengthM(forward);
      if (len < bestLen) { best = forward; bestLen = len; }
    }
    if (reverse) {
      const len = polylineLengthM(reverse);
      if (len < bestLen) {
        // Invertimos para que vaya de `from` a `to`
        best = [...reverse].reverse();
        bestLen = len;
      }
    }
    inflight.delete(key);
    if (!best) return null;
    cache.set(key, best);
    return best;
  })();

  inflight.set(key, p);
  return p;
}

/**
 * Devuelve los legs con polylines de walking enriquecidas por OSRM.
 * Los bus legs quedan sin cambios.
 */
export function useEnrichedRouteLegs(route: PlannedRouteDto | null): RouteLegDto[] | null {
  const [enrichedLegs, setEnrichedLegs] = useState<RouteLegDto[] | null>(null);

  useEffect(() => {
    if (!route) {
      setEnrichedLegs(null);
      return;
    }

    // Empezar con los legs originales (líneas rectas) → UI se renderiza inmediato
    setEnrichedLegs(route.legs);

    let cancelled = false;

    // Fetch en paralelo todos los walk legs que tengan polyline simple (2 puntos)
    const walkPromises = route.legs.map(async (leg, i) => {
      if (leg.type !== "walk" || !leg.polyline || leg.polyline.length !== 2) return null;
      const [from, to] = leg.polyline;
      const newPoly = await fetchWalkingPolyline(from, to);
      if (!newPoly || newPoly.length < 2) return null;
      return { idx: i, polyline: newPoly };
    });

    Promise.all(walkPromises).then((results) => {
      if (cancelled) return;
      // Aplicar todos los enriquecimientos sobre los legs originales
      const next = route.legs.map((l) => ({ ...l }));
      let changed = false;
      for (const r of results) {
        if (r) {
          next[r.idx] = { ...next[r.idx], polyline: r.polyline };
          changed = true;
        }
      }
      if (changed) setEnrichedLegs(next);
    });

    return () => { cancelled = true; };
  }, [route]);

  return enrichedLegs;
}
