import { describe, it, expect } from "vitest";
import { parseIntersection, findIntersectionLocal } from "@/lib/intersection-search";
import { haversineMeters } from "@/lib/geo";

describe("parseIntersection", () => {
  it("parsea 'Amezaga y Justicia'", () => {
    expect(parseIntersection("Amezaga y Justicia")).toEqual(["Amezaga", "Justicia"]);
  });

  it("parsea 'Garibaldi esq Rivadavia'", () => {
    expect(parseIntersection("Garibaldi esq Rivadavia")).toEqual(["Garibaldi", "Rivadavia"]);
  });

  it("parsea 'Av Italia y Propios'", () => {
    expect(parseIntersection("Av Italia y Propios")).toEqual(["Av Italia", "Propios"]);
  });

  it("parsea 'Bvar Artigas & 8 de Octubre' (separador &)", () => {
    expect(parseIntersection("Bvar Artigas & 8 de Octubre")).toEqual(["Bvar Artigas", "8 de Octubre"]);
  });

  it("NO parsea '18 de julio' (no es esquina)", () => {
    expect(parseIntersection("18 de julio")).toBeNull();
  });

  it("NO parsea texto muy corto", () => {
    expect(parseIntersection("a y b")).toBeNull();
  });

  it("NO parsea cadenas con solo dígitos en alguna parte", () => {
    expect(parseIntersection("Av Italia y 1234")).toBeNull();
  });

  it("NO parsea queries sin separador (un solo nombre)", () => {
    expect(parseIntersection("Tres Cruces")).toBeNull();
    expect(parseIntersection("Plaza Independencia")).toBeNull();
  });
});

/**
 * R58c — resolución LOCAL de esquinas contra nombres de paradas (sin red).
 * Regresión del bug real: "18 de julio y ejido" resolvía a un balneario de Rocha
 * porque Overpass estaba caído y el match de ciudad corría primero con prefijo.
 */
describe("findIntersectionLocal (paradas como base de esquinas)", () => {
  it("resuelve 18 de Julio y Ejido en el Centro (no en Rocha)", () => {
    const r = findIntersectionLocal("18 de julio", "ejido");
    expect(r).not.toBeNull();
    // Esquina real: -34.9057, -56.1874 — exigimos <150m (la parada ES la esquina)
    expect(haversineMeters(r!.lat, r!.lon, -34.9057, -56.1874)).toBeLessThan(150);
  });

  it("es independiente del orden de las calles", () => {
    const a = findIntersectionLocal("18 de julio", "ejido");
    const b = findIntersectionLocal("ejido", "18 de julio");
    expect(b).not.toBeNull();
    expect(haversineMeters(a!.lat, a!.lon, b!.lat, b!.lon)).toBeLessThan(150);
  });

  it("tolera prefijos y tildes (Av / Bvar / acentos)", () => {
    const r = findIntersectionLocal("Av 18 de Julio", "Ejido");
    expect(r).not.toBeNull();
    const g = findIntersectionLocal("Gral Garibaldi", "Rivadavia");
    expect(g).not.toBeNull();
  });

  it("devuelve null para calles que no se cruzan en ninguna parada", () => {
    expect(findIntersectionLocal("CalleInventadaXYZ", "OtraInventadaZZZ")).toBeNull();
  });
});
