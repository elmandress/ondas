import { describe, it, expect } from "vitest";
import { isValidMvdCoord } from "@/lib/mvd-area";

describe("isValidMvdCoord · validación adversarial de coordenadas", () => {
  it("acepta coordenadas válidas dentro del área de Montevideo", () => {
    expect(isValidMvdCoord(-34.9011, -56.1645)).toBe(true); // centro MVD
    expect(isValidMvdCoord(-34.6, -55.8)).toBe(true);        // borde superior
    expect(isValidMvdCoord(-35.0, -56.5)).toBe(true);        // borde inferior
  });

  it("rechaza NaN e Infinity (regresión VAL-2: typeof NaN==='number' se colaba)", () => {
    expect(isValidMvdCoord(NaN, NaN)).toBe(false);
    expect(isValidMvdCoord(-34.9, NaN)).toBe(false);
    expect(isValidMvdCoord(Infinity, -56.1)).toBe(false);
    expect(isValidMvdCoord(-Infinity, -Infinity)).toBe(false);
  });

  it("rechaza tipos no-numéricos (null, undefined, string, objeto)", () => {
    expect(isValidMvdCoord(null, null)).toBe(false);
    expect(isValidMvdCoord(undefined, undefined)).toBe(false);
    expect(isValidMvdCoord("-34.9", "-56.1")).toBe(false);
    expect(isValidMvdCoord({}, [])).toBe(false);
  });

  it("rechaza coordenadas fuera del área (Buenos Aires, lat/lon invertidos, 0,0)", () => {
    expect(isValidMvdCoord(-34.6037, -58.3816)).toBe(false); // Buenos Aires
    expect(isValidMvdCoord(-56.1645, -34.9011)).toBe(false); // lat/lon invertidos
    expect(isValidMvdCoord(0, 0)).toBe(false);                // null island
    expect(isValidMvdCoord(-34.5, -56.1)).toBe(false);        // justo afuera (norte)
  });
});
