/**
 * Tests del POI search local (data/mvd-pois.json).
 * Verifica que las queries problemáticas devuelven el POI correcto en top results.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const HAS_POIS = fs.existsSync(path.join(process.cwd(), "data", "mvd-pois.json"));

describe.skipIf(!HAS_POIS)("poi-search", async () => {
  const { searchPois } = await import("@/lib/poi-search");

  it("'Nuevo Centro' → Nuevocentro Shopping como primer resultado", () => {
    const r = searchPois("Nuevo Centro", 5);
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].name.toLowerCase()).toContain("nuevocentro");
    expect(r[0].category).toBe("shopping");
  });

  it("'tres cruces' devuelve Terminal y Shopping de Tres Cruces", () => {
    const r = searchPois("tres cruces", 5);
    const names = r.map((p) => p.name.toLowerCase());
    expect(names.some((n) => n.includes("tres cruces"))).toBe(true);
  });

  it("'fing' resuelve a Facultad de Ingeniería (alias)", () => {
    const r = searchPois("fing", 5);
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].name.toLowerCase()).toContain("ingenier");
  });

  it("'aeropuerto' devuelve Carrasco", () => {
    const r = searchPois("aeropuerto", 5);
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].name.toLowerCase()).toContain("aeropuerto");
  });

  it("queries que parecen dirección no dominan con POIs irrelevantes", () => {
    const r = searchPois("18 de julio", 5);
    // Si devuelve algo, no debería ser un POI random con "de" como token
    // (ex bug: "Devoto" por token "de")
    for (const p of r) {
      const n = p.name.toLowerCase();
      // No deberían aparecer "devoto" ni otros falsos positivos
      expect(n.includes("devoto") && !n.includes("18")).toBe(false);
    }
  });

  it("queries vacías devuelven []", () => {
    expect(searchPois("", 5)).toEqual([]);
  });
});
