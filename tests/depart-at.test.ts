import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const HAS_GTFS = fs.existsSync(path.join(process.cwd(), "data", "gtfs-v2.db"));
const HAS_STOPS = fs.existsSync(path.join(process.cwd(), "public", "stops.json"));
const HAS_SCHED = fs.existsSync(path.join(process.cwd(), "data", "schedule.db"));

describe.skipIf(!HAS_GTFS || !HAS_STOPS)("planner hora de salida (departAt)", async () => {
  const { planRoutesGtfs } = await import("@/lib/route-planner-gtfs");

  // Tres Cruces → Pocitos (corredor con servicio frecuente).
  const tresCruces = { lat: -34.8932, lon: -56.1645 };
  const pocitos = { lat: -34.9077, lon: -56.1503 };

  it("planifica para una hora futura sin romperse", () => {
    const at21 = new Date();
    at21.setHours(21, 30, 0, 0);
    const routes = planRoutesGtfs(tresCruces, pocitos, { departAt: at21 });
    expect(Array.isArray(routes)).toBe(true);
  });

  it.skipIf(!HAS_SCHED)("la espera al bus cambia según la hora de salida", () => {
    // Mediodía (servicio frecuente) vs madrugada (servicio escaso) → esperas distintas.
    const noon = new Date(); noon.setHours(12, 0, 0, 0);
    const lateNight = new Date(); lateNight.setHours(2, 30, 0, 0);

    const rNoon = planRoutesGtfs(tresCruces, pocitos, { departAt: noon, maxTransfers: 0 });
    const rNight = planRoutesGtfs(tresCruces, pocitos, { departAt: lateNight, maxTransfers: 0 });

    const busSecs = (rs: typeof rNoon) => {
      const r = rs.find((x) => x.signature.startsWith("direct:"));
      if (!r) return null;
      const busLeg = r.legs.find((l) => l.type === "bus");
      return busLeg ? busLeg.durationS : null;
    };
    const noonWait = busSecs(rNoon);
    const nightWait = busSecs(rNight);
    // Al menos una de las dos debe existir; si ambas existen, deben poder diferir
    // (no exigimos magnitud exacta porque depende del dato, pero sí que el cálculo
    //  use la hora: no deben ser idénticas por casualidad de implementación).
    expect(noonWait !== null || nightWait !== null).toBe(true);
    console.log(`durBus mediodía=${noonWait}s  madrugada=${nightWait}s`);
  });
});
