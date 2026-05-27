/**
 * Cache compartido de routes.json (polylines de variantes de bus).
 * Se carga una sola vez por sesión. Usado por LeafletMap (dibujar polyline)
 * y por bus-direction.ts (filtro upstream).
 */

export type RoutesIndex = Record<string, [number, number][]>;

let routesCache: RoutesIndex | null = null;
let routesPromise: Promise<RoutesIndex> | null = null;

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
