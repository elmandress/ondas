/**
 * Cache compartido de routes.json (polylines de variantes de bus).
 * Se carga una sola vez por sesión. Usado por LeafletMap (dibujar polyline)
 * y por bus-direction.ts (filtro upstream).
 */

export type RoutesIndex = Record<string, [number, number][]>;

let routesCache: RoutesIndex | null = null;
let routesPromise: Promise<RoutesIndex> | null = null;

// line-shapes.json: línea comercial ("582") → [cod_variantes con shape en routes.json].
// Necesario porque routes.json está keyado por cod_variante numérico, no por línea.
// Lo usan el trazado de rutas Y el recorrido del bus seleccionado en el mapa.
let lineShapesCache: Record<string, string[]> | null = null;
let lineShapesPromise: Promise<Record<string, string[]>> | null = null;

export function loadLineShapes(): Promise<Record<string, string[]>> {
  if (lineShapesCache) return Promise.resolve(lineShapesCache);
  if (lineShapesPromise) return lineShapesPromise;
  lineShapesPromise = fetch("/line-shapes.json")
    .then((r) => r.json())
    .then((d: Record<string, string[]>) => { lineShapesCache = d; lineShapesPromise = null; return d; })
    .catch(() => { lineShapesPromise = null; return {}; });
  return lineShapesPromise;
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
