/**
 * Enriquecimiento de los legs de una ruta:
 *  - walk legs: cambia polyline=[origen,destino] por path OSRM real por calles.
 *  - bus legs: cambia la polyline (paradas conectadas en línea recta) por el
 *    trazo real del recorrido cortando la polyline de routes.json al tramo
 *    entre fromStop y toStop.
 *
 * El render inicial usa los polylines del planner (líneas rectas) para que
 * la UI no parpadee, y luego se sustituye cuando llegan los datos enriquecidos.
 *
 * Cache compartido en módulo: si la misma ruta se vuelve a abrir, sin re-fetch.
 */
import { useEffect, useState } from "react";
import type { PlannedRouteDto, RouteLegDto } from "@/hooks/useRouteplanner";
import { loadRoutesCache, type RoutesIndex } from "@/lib/routes-cache";

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
 * Encuentra el índice en `polyline` más cercano al punto `p`.
 * O(N), pero solo se llama 2 veces por bus leg sobre polylines de ~50-300 puntos.
 */
function nearestIndex(polyline: [number, number][], p: [number, number]): number {
  let bestIdx = 0;
  let bestDistSq = Infinity;
  for (let i = 0; i < polyline.length; i++) {
    const dlat = polyline[i][0] - p[0];
    const dlon = polyline[i][1] - p[1];
    const d = dlat * dlat + dlon * dlon;
    if (d < bestDistSq) {
      bestDistSq = d;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/**
 * Dada una polyline completa del recorrido de la línea y los puntos de
 * subida/bajada, devuelve el TROZO real correspondiente.
 *
 * Si los puntos están al revés en la polyline (variante de vuelta vs ida),
 * invierte el slice para mantener orientación origen→destino.
 *
 * Si la polyline no contiene los puntos (muy lejos), devuelve null y la UI
 * mantiene las paradas conectadas.
 */
function sliceBusPolyline(
  full: [number, number][],
  from: [number, number],
  to: [number, number],
): [number, number][] | null {
  if (!full || full.length < 2) return null;
  const i = nearestIndex(full, from);
  const j = nearestIndex(full, to);
  // Distancia umbral aprox 200m: si el match es muy lejos, descartamos
  // (la polyline no corresponde a esta variante).
  const distI = haversineM(full[i], from);
  const distJ = haversineM(full[j], to);
  if (distI > 250 || distJ > 250) return null;
  if (i === j) return [from, to];
  const [a, b] = i < j ? [i, j] : [j, i];
  let slice = full.slice(a, b + 1);
  if (i > j) slice = slice.reverse();
  // Reemplazar los extremos por los puntos exactos para que conecte con stops
  return [from, ...slice.slice(1, -1), to];
}

/**
 * Devuelve los legs con polylines enriquecidas: walks por OSRM real, bus
 * legs cortando routes.json al tramo correspondiente.
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

    // Para bus legs: cargar routes.json una vez y cortar la polyline al tramo.
    // Mucho más rápido que walks (no hace fetch externo, solo lookup en memoria).
    const busPromise = (async (): Promise<Array<{ idx: number; polyline: [number, number][] } | null>> => {
      const busLegs = route.legs
        .map((leg, idx) => ({ leg, idx }))
        .filter(({ leg }) => leg.type === "bus" && leg.polyline && leg.polyline.length >= 2);
      if (!busLegs.length) return [];
      const routes: RoutesIndex = await loadRoutesCache();
      return busLegs.map(({ leg, idx }) => {
        const line = leg.lines?.[0];
        if (!line || !leg.polyline) return null;
        const full = routes[line];
        if (!full || full.length < 5) return null;
        const from = leg.polyline[0];
        const to = leg.polyline[leg.polyline.length - 1];
        const sliced = sliceBusPolyline(full, from, to);
        if (!sliced || sliced.length < 3) return null;
        return { idx, polyline: sliced };
      });
    })();

    Promise.all([Promise.all(walkPromises), busPromise]).then(([walkResults, busResults]) => {
      if (cancelled) return;
      const next = route.legs.map((l) => ({ ...l }));
      let changed = false;
      for (const r of walkResults) {
        if (r) { next[r.idx] = { ...next[r.idx], polyline: r.polyline }; changed = true; }
      }
      for (const r of busResults) {
        if (r) { next[r.idx] = { ...next[r.idx], polyline: r.polyline }; changed = true; }
      }
      if (changed) setEnrichedLegs(next);
    });

    return () => { cancelled = true; };
  }, [route]);

  return enrichedLegs;
}
