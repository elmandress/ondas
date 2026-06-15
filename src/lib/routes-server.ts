/**
 * Acceso server-side a `public/routes.json` (polilíneas de variantes de bus,
 * keyadas por cod_variante numérico = el `lineVariantId` que reporta la API de buses).
 *
 * Por qué un loader propio y no `routes-cache.ts`: ese hace `fetch("/routes.json")`
 * (cliente). En las API routes leemos el archivo con `fs` —igual que `gtfs-db.ts` con
 * `data/gtfs-v2.json`— para cero round-trips HTTP a nuestro propio estático y cache en
 * memoria del proceso.
 *
 * Uso (R69): el filtro de honestidad de `/api/stm/arrivals` proyecta el GPS del bus sobre
 * el shape de SU variante exacta (`routes[lineVariantId]`) para decidir dirección por ID,
 * sin matchear texto de headsign. Ver `busVariantTowardsStop` en `bus-direction.ts`.
 *
 * Server-only. NO importar desde código cliente.
 */
import path from "path";
import fs from "fs";
import type { RoutesIndex } from "@/lib/routes-cache";

let _routes: RoutesIndex | null = null;
let _loadFailed = false;

/** Carga routes.json desde disco (una vez). Devuelve null si no está (degrada sin tirar). */
export function getRoutesServer(): RoutesIndex | null {
  if (_routes) return _routes;
  if (_loadFailed) return null;
  try {
    const p = path.join(process.cwd(), "public", "routes.json");
    if (!fs.existsSync(p)) {
      console.warn("[routes-server] no routes.json found in public/");
      _loadFailed = true;
      return null;
    }
    _routes = JSON.parse(fs.readFileSync(p, "utf-8")) as RoutesIndex;
    return _routes;
  } catch (err) {
    console.error("[routes-server] error cargando routes.json:", err);
    _loadFailed = true;
    return null;
  }
}
