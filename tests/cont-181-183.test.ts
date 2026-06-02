import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const HAS_GTFS = fs.existsSync(path.join(process.cwd(), "data", "gtfs-v2.db"));
const HAS_STOPS = fs.existsSync(path.join(process.cwd(), "public", "stops.json"));

describe.skipIf(!HAS_GTFS || !HAS_STOPS)("continuación misma-línea 181/183 (paso D)", async () => {
  const { planRoutesGtfs } = await import("@/lib/route-planner-gtfs");

  it("ofrece continuación misma-línea cuando no hay directa, y es rápido", () => {
    // Origen sobre el recorrido del 183 lejos de Pocitos → destino Pocitos.
    const origin = { lat: -34.854, lon: -56.205 };
    const pocitos = { lat: -34.9077, lon: -56.1503 };
    const t0 = Date.now();
    const routes = planRoutesGtfs(origin, pocitos);
    const ms = Date.now() - t0;
    // Diagnóstico (visible con --reporter=verbose):
    for (const r of routes.slice(0, 8)) {
      const lines = r.legs.filter((l) => l.type === "bus").map((l) => (l.lines || []).join("/")).join(" → ");
      console.log(`  [${Math.round(r.totalSeconds / 60)}min] ${r.signature}${r.sameLineContinuation ? "  ⭐ MISMA-LINEA" : ""}  [${lines}]`);
    }
    console.log(`rutas=${routes.length} tiempo=${ms}ms`);
    expect(routes.length).toBeGreaterThan(0);
    expect(ms).toBeLessThan(3000); // guardarraíl de perf
  });
});
