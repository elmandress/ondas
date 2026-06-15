/**
 * R69 — honestidad de dirección por VARIANTE EXACTA (gate de `routes.json[lineVariantId]`).
 *
 * Pin de regresión del bug "killer #1": buses de sentido opuesto / calle paralela / ya
 * pasados mostrados como "llegando". El filtro GTFS por headsign-text los dejaba pasar
 * cuando el destino no matcheaba; este gate decide por el shape EXACTO del bus.
 *
 * Parte 1: función pura con shapes sintéticos (siempre corre, determinística).
 * Parte 2: caso canónico REAL parada 2201 / línea 505 con `public/routes.json`
 *          (skip si el archivo no está). Reproduce lo verificado en vivo: el sentido
 *          servido snapea ~4 m (serves-going / passed según el along); el OPUESTO
 *          (Andaluz, dir 0) snapea ~101 m → not-on-route. Si esto rompe, hay regresión.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { busVariantTowardsStop } from "@/lib/bus-direction";
import type { RoutesIndex } from "@/lib/routes-cache";

// Shape horizontal O→E a latitud fija: el `along` crece hacia el este.
function horizontalShape(lat: number, lonStart: number, lonEnd: number, n = 21): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) pts.push([lat, lonStart + ((lonEnd - lonStart) * i) / (n - 1)]);
  return pts;
}

describe("busVariantTowardsStop · función pura (shapes sintéticos)", () => {
  const LAT = -34.9044;
  const shape = horizontalShape(LAT, -56.2, -56.17); // ~2.7 km O→E
  const routes: RoutesIndex = { "777": shape };
  const stop = { lat: LAT, lon: -56.185 }; // sobre el recorrido, al medio

  it("no-shape cuando la variante no está en routes", () => {
    expect(busVariantTowardsStop("999", LAT, -56.19, stop.lat, stop.lon, routes)).toBe("no-shape");
    expect(busVariantTowardsStop(null, LAT, -56.19, stop.lat, stop.lon, routes)).toBe("no-shape");
    expect(busVariantTowardsStop("777", LAT, -56.19, stop.lat, stop.lon, null)).toBe("no-shape");
  });

  it("serves-going: bus ANTES de la parada por el recorrido (al oeste)", () => {
    expect(busVariantTowardsStop("777", LAT, -56.196, stop.lat, stop.lon, routes)).toBe("serves-going");
  });

  it("passed: bus DESPUÉS de la parada por el recorrido (al este)", () => {
    expect(busVariantTowardsStop("777", LAT, -56.174, stop.lat, stop.lon, routes)).toBe("passed");
  });

  it("not-on-route: la parada está ~100 m del shape (sentido opuesto / calle paralela)", () => {
    const offStop = { lat: LAT + 0.0009, lon: -56.185 }; // ~100 m al norte del recorrido
    expect(busVariantTowardsStop("777", LAT, -56.196, offStop.lat, offStop.lon, routes)).toBe("not-on-route");
  });

  it("serves-going aún con offset de cordón (~30 m): no falso-negativo", () => {
    const curbStop = { lat: LAT + 0.00027, lon: -56.185 }; // ~30 m: cordón, sigue servida
    expect(busVariantTowardsStop("777", LAT, -56.196, curbStop.lat, curbStop.lon, routes)).toBe("serves-going");
  });
});

// ── Parte 2: caso real 2201 / 505 (pin del comportamiento verificado en vivo) ──
const ROUTES_PATH = path.join(process.cwd(), "public", "routes.json");
const STOPS_PATH = path.join(process.cwd(), "public", "stops.json");
const HAS_DATA = fs.existsSync(ROUTES_PATH) && fs.existsSync(STOPS_PATH);

describe.skipIf(!HAS_DATA)("busVariantTowardsStop · caso real 2201 / línea 505", () => {
  const routes = JSON.parse(fs.readFileSync(ROUTES_PATH, "utf-8")) as RoutesIndex;
  const stops = JSON.parse(fs.readFileSync(STOPS_PATH, "utf-8")) as Array<{
    stopId: string; stopLat: number; stopLon: number;
  }>;
  const s2201 = stops.find((s) => s.stopId === "2201");

  it("2201 existe en el dataset", () => {
    expect(s2201).toBeDefined();
  });

  // 4005 (→ADUANA) y 4649 (→CIUDADELA) = dir 1, SÍ sirven 2201 (snap ~4 m).
  // 4006 (→ANDALUZ) = dir 0, NO sirve 2201 (snap ~101 m).
  it.skipIf(!HAS_DATA)("sentido OPUESTO (4006 →Andaluz, dir 0) → not-on-route", () => {
    if (!s2201 || !routes["4006"]) return;
    // Sea cual sea la posición del bus, el shape opuesto no roza la parada.
    const sh = routes["4006"];
    const mid = sh[Math.floor(sh.length / 2)];
    const v = busVariantTowardsStop("4006", mid[0], mid[1], s2201.stopLat, s2201.stopLon, routes);
    expect(v).toBe("not-on-route");
  });

  it.skipIf(!HAS_DATA)("sentido SERVIDO (4005 →Aduana, dir 1): viene antes, pasó después", () => {
    if (!s2201 || !routes["4005"]) return;
    const sh = routes["4005"];
    // La parada 2201 cae cerca del final del recorrido 4005 (~84% del along). Un punto
    // a mitad del shape está ANTES; el penúltimo punto está DESPUÉS.
    const before = sh[Math.floor(sh.length * 0.5)];
    const after = sh[sh.length - 2];
    expect(busVariantTowardsStop("4005", before[0], before[1], s2201.stopLat, s2201.stopLon, routes)).toBe("serves-going");
    expect(busVariantTowardsStop("4005", after[0], after[1], s2201.stopLat, s2201.stopLon, routes)).toBe("passed");
  });

  it.skipIf(!HAS_DATA)("sentido SERVIDO (4649 →Ciudadela, dir 1) reconocido como ruta válida", () => {
    if (!s2201 || !routes["4649"]) return;
    const sh = routes["4649"];
    const before = sh[Math.floor(sh.length * 0.4)];
    // No es not-on-route (el shape SÍ pasa por la parada).
    expect(busVariantTowardsStop("4649", before[0], before[1], s2201.stopLat, s2201.stopLon, routes)).not.toBe("not-on-route");
  });
});
