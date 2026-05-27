/**
 * Acceso a routes.json desde server-side (API routes).
 * NO importar desde código cliente — usa fs.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require("path") as typeof import("path");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require("fs") as typeof import("fs");

export type RoutesIndex = Record<string, [number, number][]>;

let _routes: RoutesIndex | null = null;

export function getRoutesServerSync(): RoutesIndex | null {
  if (_routes) return _routes;
  try {
    const ROUTES_PATH = path.join(process.cwd(), "public", "routes.json");
    if (!fs.existsSync(ROUTES_PATH)) return null;
    const raw = fs.readFileSync(ROUTES_PATH, "utf-8");
    _routes = JSON.parse(raw);
    return _routes;
  } catch (err) {
    console.error("[routes-server] error loading routes.json:", err);
    return null;
  }
}
