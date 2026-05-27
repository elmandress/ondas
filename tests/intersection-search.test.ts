import { describe, it, expect } from "vitest";
import { parseIntersection } from "@/lib/intersection-search";

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
