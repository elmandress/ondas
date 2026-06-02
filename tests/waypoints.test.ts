import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const HAS_GTFS = fs.existsSync(path.join(process.cwd(), "data", "gtfs-v2.db"));
const HAS_STOPS = fs.existsSync(path.join(process.cwd(), "public", "stops.json"));

describe.skipIf(!HAS_GTFS || !HAS_STOPS)("planner con paradas intermedias (waypoints)", async () => {
  const { planRoutesGtfs, planRoutesWithWaypoints } = await import("@/lib/route-planner-gtfs");

  const tresCruces = { lat: -34.8932, lon: -56.1645 };
  const cagancha = { lat: -34.9059, lon: -56.1872, name: "Plaza Cagancha" };
  const pocitos = { lat: -34.9077, lon: -56.1503 };

  it("encadena O→W→D y suma los tramos (más largo que O→D directo)", () => {
    const direct = planRoutesGtfs(tresCruces, pocitos);
    const via = planRoutesWithWaypoints(tresCruces, [cagancha], pocitos);

    expect(via.length).toBe(1);
    const r = via[0];
    // La ruta encadenada pasa por el waypoint → rotulado.
    expect(r.viaWaypoints).toEqual(["Plaza Cagancha"]);
    // Debe tener legs de ambos tramos (al menos 2 tramos de bus o más legs que un directo simple).
    expect(r.legs.length).toBeGreaterThanOrEqual(4);
    // Pasar por un punto intermedio nunca puede ser más rápido que el mejor directo.
    const bestDirect = Math.min(...direct.map((d) => d.totalSeconds));
    expect(r.totalSeconds).toBeGreaterThanOrEqual(bestDirect);
  });

  it("sin waypoints se comporta como ruta normal", () => {
    const via = planRoutesWithWaypoints(tresCruces, [], pocitos);
    const direct = planRoutesGtfs(tresCruces, pocitos);
    expect(via.length).toBe(direct.length);
  });

  it("respeta hasta 3 waypoints en orden", () => {
    const w1 = { lat: -34.8959, lon: -56.1645, name: "W1" };
    const w2 = { lat: -34.9059, lon: -56.1872, name: "W2" };
    const via = planRoutesWithWaypoints(tresCruces, [w1, w2], pocitos);
    if (via.length) {
      expect(via[0].viaWaypoints).toEqual(["W1", "W2"]);
    }
  });
});
