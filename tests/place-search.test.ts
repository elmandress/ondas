import { describe, it, expect } from "vitest";
import { isSearchableQuery } from "@/hooks/usePlaceSearch";

/**
 * Lógica pura del hook de búsqueda unificada (R68). El debounce/abort es interno del
 * hook (React) y se verifica e2e; acá fijamos el guard de query que decide si vale la
 * pena pegarle a /api/geocode (evita requests por vacío o por basura absurda).
 */
describe("usePlaceSearch · isSearchableQuery", () => {
  it("acepta query con contenido (trim, 1–300)", () => {
    expect(isSearchableQuery("a")).toBe(true);
    expect(isSearchableQuery("pocitos")).toBe(true);
    expect(isSearchableQuery("  tres cruces  ")).toBe(true);
    expect(isSearchableQuery("x".repeat(300))).toBe(true);
  });

  it("rechaza vacío / sólo espacios", () => {
    expect(isSearchableQuery("")).toBe(false);
    expect(isSearchableQuery("   ")).toBe(false);
    expect(isSearchableQuery("\n\t")).toBe(false);
  });

  it("rechaza query absurdamente larga (>300)", () => {
    expect(isSearchableQuery("x".repeat(301))).toBe(false);
  });
});
