/**
 * Tests de canonicalización de nombres de línea (R57).
 *
 * El mismo bus aparece como "CE1" (GPS en vivo), "Ce1" (GTFS) o "CE1" con
 * espacios raros según la fuente. Comparar con === dejaba líneas enteras sin
 * filtro de dirección, sin horarios y sin shape (bug confirmado en auditoría).
 */
import { describe, it, expect } from "vitest";
import { canonLine, sameLine } from "@/lib/line-name";
import { getShapesForLine } from "@/lib/routes-cache";

describe("canonLine", () => {
  it("unifica mayúsculas/minúsculas", () => {
    expect(canonLine("Ce1")).toBe("CE1");
    expect(canonLine("CE1")).toBe("CE1");
    expect(canonLine("bt2")).toBe("BT2");
  });

  it("colapsa espacios y recorta extremos", () => {
    expect(canonLine(" 124  Sd ")).toBe("124 SD");
    expect(canonLine("124 SD")).toBe("124 SD");
  });

  it("no toca líneas numéricas", () => {
    expect(canonLine("76")).toBe("76");
    expect(canonLine("582")).toBe("582");
  });
});

describe("sameLine", () => {
  it("matchea la misma línea entre fuentes (GPS vivo vs GTFS)", () => {
    expect(sameLine("CE1", "Ce1")).toBe(true);
    expect(sameLine("124 SD", "124 Sd")).toBe(true);
    expect(sameLine("L32", "l32")).toBe(true);
  });

  it("no matchea líneas distintas", () => {
    expect(sameLine("CE1", "CE2")).toBe(false);
    expect(sameLine("76", "176")).toBe(false);
  });
});

describe("getShapesForLine", () => {
  it("encuentra shapes sin importar la grafía de la fuente", () => {
    const idx = { CE1: ["100", "101"], "582": ["8922"] };
    expect(getShapesForLine(idx, "Ce1")).toEqual(["100", "101"]);
    expect(getShapesForLine(idx, "CE1")).toEqual(["100", "101"]);
    expect(getShapesForLine(idx, "582")).toEqual(["8922"]);
    expect(getShapesForLine(idx, "999")).toEqual([]);
  });
});
