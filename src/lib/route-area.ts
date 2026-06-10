/**
 * Clasificación de área de cobertura del planificador (FR-4.6).
 * Bbox COBERTURA: MVD + Canelones cercano (Cdad de la Costa, Las Piedras,
 * La Paz, Pando, Atlántida hasta Salinas). STM no cubre fuera de esto.
 * Puro y sin dependencias de UI → testeable.
 */
import { haversineKm } from "@/lib/geo";

export const COVERAGE_BBOX = { north: -34.5, south: -35.0, west: -56.5, east: -55.5 };

interface Point { lat: number; lon: number }

function inBbox(p: Point, b: typeof COVERAGE_BBOX): boolean {
  return p.lat <= b.north && p.lat >= b.south && p.lon >= b.west && p.lon <= b.east;
}

export type AreaCheck =
  | { kind: "ok" }
  | { kind: "out-of-coverage"; which: "from" | "to" | "both" }
  | { kind: "interdepartmental"; which: "from" | "to" | "both" };

/** Distancia aproximada en km a Plaza Independencia. */
function distFromMvd(p: Point): number {
  return haversineKm(p.lat, p.lon, -34.9058, -56.1913);
}

export function classifyArea(from: Point | null, to: Point | null): AreaCheck {
  const fromState = !from ? "ok" : inBbox(from, COVERAGE_BBOX) ? "ok" : "out";
  const toState = !to ? "ok" : inBbox(to, COVERAGE_BBOX) ? "ok" : "out";
  if (fromState === "ok" && toState === "ok") return { kind: "ok" };
  // Si ambos están fuera y muy lejos: interdepartamental
  const fromVeryFar = from && !inBbox(from, COVERAGE_BBOX) && distFromMvd(from) > 80;
  const toVeryFar = to && !inBbox(to, COVERAGE_BBOX) && distFromMvd(to) > 80;
  if (fromVeryFar || toVeryFar) {
    const which: "from" | "to" | "both" =
      fromVeryFar && toVeryFar ? "both" : fromVeryFar ? "from" : "to";
    return { kind: "interdepartmental", which };
  }
  const which: "from" | "to" | "both" =
    fromState === "out" && toState === "out" ? "both" :
    fromState === "out" ? "from" : "to";
  return { kind: "out-of-coverage", which };
}
