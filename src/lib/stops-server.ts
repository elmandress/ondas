/**
 * Acceso a stops.json desde server-side (API routes).
 * NO importar desde código cliente — usa fs.
 *
 * Equivalente server de STOPS_DATASET (que hace fetch del público y solo anda en cliente).
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require("path") as typeof import("path");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require("fs") as typeof import("fs");

import type { StopRecord } from "./stops-dataset";

let _stops: StopRecord[] | null = null;

export function getStopsServerSync(): StopRecord[] {
  if (_stops) return _stops;
  try {
    const STOPS_PATH = path.join(process.cwd(), "public", "stops.json");
    if (!fs.existsSync(STOPS_PATH)) return [];
    const raw = fs.readFileSync(STOPS_PATH, "utf-8");
    _stops = JSON.parse(raw);
    return _stops!;
  } catch (err) {
    console.error("[stops-server] error loading stops.json:", err);
    return [];
  }
}

export function findStopServer(stopId: string): StopRecord | null {
  const stops = getStopsServerSync();
  return stops.find((s) => s.stopId === stopId) || null;
}
