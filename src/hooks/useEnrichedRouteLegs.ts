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
import { loadRoutesCache, loadLineShapes, type RoutesIndex } from "@/lib/routes-cache";
import { haversineMeters } from "@/lib/geo";
// line-shapes.json (línea → cod_variantes con shape) ahora vive en routes-cache.ts,
// compartido con el recorrido del bus del mapa. Necesario porque el variantId del
// motor ("181-0-1") no es la key de routes.json (cod_variante numérico "8389").

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
// Distancia haversine entre 2 puntos [lat, lon] (metros)
function haversineM(a: [number, number], b: [number, number]): number {
  return haversineMeters(a[0], a[1], b[0], b[1]);
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
// Router PEATONAL real de OSM (perfil foot — ignora sentidos de calle, como debe ser
// para una persona caminando). El OSRM público solo hace AUTO (respeta one-way) y por eso
// hacía "dar la vuelta a la manzana".
const FOOT_OSRM = "https://routing.openstreetmap.de/routed-foot/route/v1/foot";

async function fetchFootRoute(from: [number, number], to: [number, number]): Promise<[number, number][] | null> {
  const url = `${FOOT_OSRM}/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3500);
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    const data = await r.json() as { routes?: { geometry: { coordinates: [number, number][] } }[] };
    const geo = data.routes?.[0]?.geometry?.coordinates;
    if (!geo || geo.length < 2) return null;
    const path = geo.map(([lon, lat]) => [lat, lon] as [number, number]);
    // OSRM snapea los extremos a la calle (~10m). Fijamos el primer y último
    // punto al origen/parada EXACTOS para que la línea toque la parada real
    // (si no, la parada se ve "minimamente movida" respecto al trazo).
    path[0] = from;
    path[path.length - 1] = to;
    return path;
  } catch {
    return null;
  }
}

async function fetchWalkingPolyline(from: [number, number], to: [number, number]): Promise<[number, number][] | null> {
  const key = keyFor(from, to);
  if (cache.has(key)) return cache.get(key)!;
  if (inflight.has(key)) return inflight.get(key)!;

  const p = (async () => {
    const poly = await fetchFootRoute(from, to);
    inflight.delete(key);
    if (!poly || poly.length < 2) return null;
    // Control de cordura MUY laxo: el perfil foot ya ignora el sentido, así que un
    // desvío peatonal es real (no hay paso directo) y SE DEBE mostrar. Solo
    // descartamos respuestas claramente rotas (>3.5x la recta = ruteó a otro lado).
    const straight = haversineM(from, to);
    if (polylineLengthM(poly) > Math.max(400, straight * 3.5)) return null;
    cache.set(key, poly);
    return poly;
  })();

  inflight.set(key, p);
  return p;
}

/**
 * Índice del punto de `shape` más cercano a `pt` (parada real de subida/bajada).
 * Permite recortar la shape de la variante al tramo que recorre el pasajero.
 */
function nearestIndex(shape: [number, number][], pt: [number, number]): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < shape.length; i++) {
    const d = haversineM(shape[i], pt);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

/** Distancia mínima de un punto a cualquier vértice de la shape (cobertura). */
function minDistToShape(shape: [number, number][], pt: [number, number]): number {
  let m = Infinity;
  for (const p of shape) { const d = haversineM(p, pt); if (d < m) m = d; }
  return m;
}

/**
 * Recorta UNA shape al tramo subida→bajada. Devuelve el clip + un "maxGap" (la peor
 * distancia de una parada intermedia del leg a la shape) para poder elegir, entre
 * varias shapes candidatas de la misma línea, la que MEJOR cubre el recorrido real.
 */
function clipOneShape(
  shape: [number, number][],
  legPolyline: [number, number][]
): { clip: [number, number][]; maxGap: number } | null {
  if (!shape || shape.length < 2) return null;
  const board = legPolyline[0];
  const alight = legPolyline[legPolyline.length - 1];
  let iA = nearestIndex(shape, board);
  let iB = nearestIndex(shape, alight);
  if (iA === iB) return null;
  const reversed = iA > iB;
  if (reversed) { const t = iA; iA = iB; iB = t; }
  // Las anclas deben caer sobre la shape (≤250m) — si no, esta shape no es de este tramo.
  if (haversineM(shape[iA], reversed ? alight : board) > 250) return null;
  if (haversineM(shape[iB], reversed ? board : alight) > 250) return null;
  let clip = shape.slice(iA, iB + 1);
  if (reversed) clip = clip.slice().reverse();
  if (clip.length < 2) return null;
  // Cobertura: cuánto se aleja cada parada intermedia del leg de este clip. Si una
  // parada queda lejos del trazo, esta shape no representa el recorrido → descartable.
  let maxGap = 0;
  for (let k = 1; k < legPolyline.length - 1; k++) {
    const g = minDistToShape(clip, legPolyline[k]);
    if (g > maxGap) maxGap = g;
  }
  clip[0] = board;
  clip[clip.length - 1] = alight;
  return { clip, maxGap };
}

/**
 * Trazo real por calles de un bus leg. El variantId del motor (ej "181-0-1") NO es la
 * key de routes.json (que es cod_variante numérico, ej "8389"). Por eso probamos TODAS
 * las shapes de la LÍNEA (line-shapes.json: línea→cod_variantes con shape) y elegimos la
 * que mejor cubre las paradas reales del leg (menor maxGap). Si ninguna cubre bien
 * (>120m), devolvemos null → queda la recta de paradas (honesto, sin inventar el camino).
 */
function clipBestShape(
  routes: RoutesIndex,
  lineShapes: Record<string, string[]>,
  line: string | undefined,
  legPolyline: [number, number][] | undefined
): [number, number][] | null {
  if (!line || !legPolyline || legPolyline.length < 2) return null;
  const candidates = lineShapes[line];
  if (!candidates || !candidates.length) return null;

  let best: { clip: [number, number][]; maxGap: number } | null = null;
  for (const cv of candidates) {
    const shape = routes[cv];
    if (!shape) continue;
    const r = clipOneShape(shape, legPolyline);
    if (r && (!best || r.maxGap < best.maxGap)) best = r;
  }
  // Solo aceptamos si el recorrido cubre las paradas razonablemente (≤120m de gap).
  if (best && best.maxGap <= 120) return best.clip;
  return null;
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
      // Solo evitamos el router para tramos triviales (<40m: la parada está ahí
      // nomás, cruzás derecho). Para todo lo demás el peatón DEBE seguir las
      // calles (por la vereda) — el perfil foot ignora el sentido, así que es el
      // camino más corto real, no una diagonal cruzando manzanas.
      if (haversineM(from, to) < 40) return null;
      const newPoly = await fetchWalkingPolyline(from, to);
      if (!newPoly || newPoly.length < 2) return null;
      return { idx: i, polyline: newPoly };
    });

    // Bus legs: enriquecemos con el recorrido real por calles, pero SOLO usando la
    // shape de la VARIANTE EXACTA (routes[variantId]) recortada al tramo subida→bajada.
    // routes.json ahora está keyado por cod_variante (pipeline regenerado desde el
    // shapefile oficial v_uptu_lsv). Nunca caemos a otra variante de la misma línea
    // (podría ir en sentido contrario → bug que ya tuvimos). Si la variante no tiene
    // shape en el feed oficial, clipBestShape devuelve null y queda la recta de
    // paradas reales (honesto, nunca un camino equivocado).
    const busPromise = Promise.all([loadRoutesCache(), loadLineShapes()]).then(([routes, lineShapes]) =>
      route.legs.map((leg, i) => {
        if (leg.type !== "bus") return null;
        const line = leg.lines && leg.lines.length ? leg.lines[0] : undefined;
        const clipped = clipBestShape(routes, lineShapes, line, leg.polyline);
        return clipped ? { idx: i, polyline: clipped } : null;
      })
    );

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
