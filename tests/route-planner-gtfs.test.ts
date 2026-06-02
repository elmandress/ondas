/**
 * Tests del planificador GTFS.
 *
 * Cubre regresiones reportadas:
 *   - "6 opciones idénticas con la misma línea 183" → ahora máx 1 por línea
 *   - "no aparece Caminar en distancias cortas" → siempre incluido si <2.5km
 *   - "124 Sd y 124 como rutas distintas" → normalizar sufijos de día
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const HAS_GTFS = fs.existsSync(path.join(process.cwd(), "data", "gtfs.db"));
const HAS_STOPS = fs.existsSync(path.join(process.cwd(), "public", "stops.json"));

describe.skipIf(!HAS_GTFS || !HAS_STOPS)("route-planner-gtfs", async () => {
  const { planRoutesGtfs } = await import("@/lib/route-planner-gtfs");

  // Coords reales
  const nuevocentro = { lat: -34.8689, lon: -56.1697 };
  const tresCruces = { lat: -34.8932, lon: -56.1645 };
  const cagancha = { lat: -34.9059, lon: -56.1872 };
  const independencia = { lat: -34.9072, lon: -56.2032 };
  const pocitos = { lat: -34.9077, lon: -56.1503 };
  const cerro = { lat: -34.8800, lon: -56.2700 };

  it("no devuelve duplicados con la misma línea (Nuevocentro → Tres Cruces)", () => {
    const routes = planRoutesGtfs(nuevocentro, tresCruces);
    expect(routes.length).toBeGreaterThan(0);
    const signatures = routes.map((r) => r.signature);
    expect(new Set(signatures).size).toBe(signatures.length);
  });

  it("rutas equivalentes se agrupan con 'alternatives' count", () => {
    const routes = planRoutesGtfs(nuevocentro, tresCruces);
    // Debería haber al menos una ruta con alternatives > 0
    // (varias paradas equivalentes con la misma línea)
    const withAlts = routes.filter((r) => (r.alternatives ?? 0) > 0);
    expect(withAlts.length).toBeGreaterThan(0);
  });

  it("incluye opción 'walk' cuando distancia <2.5km", () => {
    const routes = planRoutesGtfs(cagancha, independencia);
    const hasWalk = routes.some((r) => r.signature === "walk");
    expect(hasWalk).toBe(true);
  });

  // pocitos→cerro (cross-city ~12km) es el caso más pesado. Con la memo de directas
  // baja a <1s; dejamos el timeout default (5s) como guardarraíl anti-regresión de perf.
  it("NO incluye 'walk' cuando distancia >2.5km", () => {
    const routes = planRoutesGtfs(pocitos, cerro);
    const hasWalk = routes.some((r) => r.signature === "walk");
    expect(hasWalk).toBe(false);
  });

  it("normaliza sufijos de día: '124 Sd' === '124'", async () => {
    // Test directo de la lógica de normalización
    const routes = planRoutesGtfs(pocitos, cerro);
    const sigs = routes.map((r) => r.signature);
    // No debe haber transferencias con la misma línea con/sin sufijo
    for (const sig of sigs) {
      if (!sig.startsWith("transfer:")) continue;
      const lines = sig.replace("transfer:", "").split("+");
      const noSuffix = lines.map((l) => l.replace(/\s+(Sd|Sa|D|N)$/i, "").trim());
      // No deberíamos tener "X" y "X Sd" en la misma signature
      expect(new Set(noSuffix).size).toBe(noSuffix.length);
    }
  });

  it("ordena por tiempo total ascendente (con walk al final si es más lento)", () => {
    const routes = planRoutesGtfs(cagancha, independencia);
    const nonWalk = routes.filter((r) => r.signature !== "walk");
    // Las rutas no-walk deben estar ordenadas
    for (let i = 1; i < nonWalk.length; i++) {
      expect(nonWalk[i].totalSeconds).toBeGreaterThanOrEqual(nonWalk[i - 1].totalSeconds);
    }
  });

  it("legs siempre empiezan y terminan con walk", () => {
    const routes = planRoutesGtfs(nuevocentro, tresCruces);
    for (const r of routes) {
      if (r.signature === "walk") continue;
      expect(r.legs[0].type).toBe("walk");
      expect(r.legs[r.legs.length - 1].type).toBe("walk");
    }
  });

  it("máximo 5 resultados", () => {
    const routes = planRoutesGtfs(pocitos, cerro);
    expect(routes.length).toBeLessThanOrEqual(5);
  });
});
