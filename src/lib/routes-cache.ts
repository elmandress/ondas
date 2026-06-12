/**
 * Cache compartido de routes.json (polylines de variantes de bus).
 * Se carga una sola vez por sesión. Usado por LeafletMap (dibujar polyline)
 * y por bus-direction.ts (filtro upstream).
 */

import { canonLine } from "@/lib/line-name";

export type RoutesIndex = Record<string, [number, number][]>;

let routesCache: RoutesIndex | null = null;
let routesPromise: Promise<RoutesIndex> | null = null;

// line-shapes.json: línea comercial ("582") → [cod_variantes con shape en routes.json].
// Necesario porque routes.json está keyado por cod_variante numérico, no por línea.
// Lo usan el trazado de rutas Y el recorrido del bus seleccionado en el mapa.
// Las keys se CANONICALIZAN al cargar (mayúsculas): el feed SIT escribe "CE1" pero el
// planner GTFS pide "Ce1" (bug R57). Buscar siempre con getShapesForLine().
let lineShapesCache: Record<string, string[]> | null = null;
let lineShapesPromise: Promise<Record<string, string[]>> | null = null;

export function loadLineShapes(): Promise<Record<string, string[]>> {
  if (lineShapesCache) return Promise.resolve(lineShapesCache);
  if (lineShapesPromise) return lineShapesPromise;
  lineShapesPromise = fetch("/line-shapes.json")
    .then((r) => r.json())
    .then((d: Record<string, string[]>) => {
      const canon: Record<string, string[]> = {};
      for (const [k, cvs] of Object.entries(d)) {
        const ck = canonLine(k);
        if (canon[ck]) canon[ck] = [...new Set([...canon[ck], ...cvs])];
        else canon[ck] = cvs;
      }
      lineShapesCache = canon;
      lineShapesPromise = null;
      return canon;
    })
    .catch(() => { lineShapesPromise = null; return {}; });
  return lineShapesPromise;
}

/** cod_variantes con shape para una línea, sin importar la grafía de la fuente. */
export function getShapesForLine(lineShapes: Record<string, string[]>, line: string): string[] {
  return lineShapes[canonLine(line)] || [];
}

export function getRoutesCache(): RoutesIndex | null {
  return routesCache;
}

export function loadRoutesCache(): Promise<RoutesIndex> {
  if (routesCache) return Promise.resolve(routesCache);
  if (routesPromise) return routesPromise;
  routesPromise = fetch("/routes.json")
    .then((r) => r.json())
    .then((data: RoutesIndex) => {
      routesCache = data;
      routesPromise = null;
      return data;
    })
    .catch((err) => {
      console.error("[routes-cache] error cargando routes.json", err);
      routesPromise = null;
      return {} as RoutesIndex;
    });
  return routesPromise;
}
