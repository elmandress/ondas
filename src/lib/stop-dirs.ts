/**
 * stop-dirs.json: pista de SENTIDO ("hacia X") para paradas con nombre duplicado.
 * Generado por scripts/build-stop-dirs.mjs desde el GTFS (headsign dominante de las
 * variantes que sirven la parada). Solo existe para duplicadas donde la pista
 * realmente desambigua — para el resto el lookup da undefined y no se muestra nada.
 *
 * Carga lazy + cache de módulo (mismo patrón que routes-cache).
 */
let cache: Record<string, string> | null = null;
let promise: Promise<Record<string, string>> | null = null;

export function loadStopDirs(): Promise<Record<string, string>> {
  if (cache) return Promise.resolve(cache);
  if (promise) return promise;
  promise = fetch("/stop-dirs.json")
    .then((r) => r.json())
    .then((d: Record<string, string>) => { cache = d; promise = null; return d; })
    .catch(() => { promise = null; return {}; });
  return promise;
}
