import { describe, it, expect } from "vitest";
import { getServiceWindow, getLineHoursLookup } from "@/lib/line-hours";
import { getLineHeadsigns, getVariantsForLine, getStopSequence } from "@/lib/gtfs-db";
import { assessTripSafety, saferAlternative } from "@/lib/trip-safety";
import { estimateFare, fareLabel } from "@/lib/fare";

/**
 * Tests de DEGRADACIÓN: el sistema debe seguir en pie ante datos faltantes, líneas
 * inexistentes o entradas vacías — devolver vacío/null, nunca tirar una excepción.
 * (Un dataset incompleto o una línea que no está en el GTFS no debe romper la app.)
 */
describe("degradación · líneas/paradas inexistentes no crashean", () => {
  it("getServiceWindow de una línea inexistente → null", () => {
    expect(getServiceWindow("LINEA_QUE_NO_EXISTE_999")).toBeNull();
    expect(getServiceWindow("")).toBeNull();
  });

  it("getLineHeadsigns / getVariantsForLine de línea inexistente → vacío", () => {
    expect(getLineHeadsigns("XYZ-999")).toEqual([]);
    expect(getVariantsForLine("XYZ-999")).toEqual([]);
  });

  it("getStopSequence con variante/parada inexistente → null", () => {
    expect(getStopSequence("variante-fantasma", "999999")).toBeNull();
  });

  it("getLineHoursLookup no rompe con líneas desconocidas (fail-open)", () => {
    const lk = getLineHoursLookup(new Date());
    expect(lk.hasData("NOEXISTE")).toBe(false);
    // fail-open: sin datos no filtramos (devuelve true = "no la ocultes")
    expect(lk.operatesNowOrSoon("NOEXISTE")).toBe(true);
    expect(lk.endOfCurrentBlock("NOEXISTE")).toBeNull();
  });
});

describe("degradación · entradas vacías en lógica pura", () => {
  it("assessTripSafety con viaje sin legs → level none, sin throw", () => {
    const r = assessTripSafety({ legs: [], numTransfers: 0 });
    expect(r.level).toBe("none");
    expect(r.exposureScore).toBe(0);
  });

  it("saferAlternative con 0/1 rutas → null (no compara nada)", () => {
    expect(saferAlternative([], [], 0)).toBeNull();
    expect(saferAlternative([{ legs: [], numTransfers: 0 }], [100], 0)).toBeNull();
  });

  it("estimateFare/fareLabel con transbordos extremos no rompen", () => {
    expect(estimateFare(0).cash).toBeGreaterThan(0);
    expect(estimateFare(99).exact).toBe(false); // muchos transbordos → no garantiza 1 boleto
    expect(fareLabel(-1)).toContain("efectivo");
  });
});
