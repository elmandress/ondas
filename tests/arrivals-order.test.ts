/**
 * R69 — orden canónico de la lista de llegadas (honestidad de la lista).
 *
 * El endpoint concatena vivo + programado y los ordena por ETA antes de devolver. Si el
 * primero de la lista no es el que antes llega, el usuario mira mal y pierde el bus. Estos
 * tests fijan el invariante para que NO pueda regresar en silencio (mismo criterio que el
 * pin del SW): mezcla vivo+programado → ascendente por minutos; y el guard de finitud que
 * es la única forma en que el comparador `a.eta - b.eta` podía romper el orden del set.
 */
import { describe, it, expect } from "vitest";
import { sortArrivalsByEta } from "@/lib/stm";
import type { Arrival } from "@/lib/stm";

function mk(eta: number, realtime: boolean, line = "X"): Arrival {
  return {
    lineId: line, lineName: line, destination: "DEST", destinationCode: 0,
    eta, etaSeconds: eta * 60, realtime, isScheduled: !realtime,
  };
}

describe("sortArrivalsByEta — orden canónico de llegadas", () => {
  it("mezcla vivo+programado desordenada → ascendente por minutos", () => {
    const mixed = [
      mk(12, true), mk(3, false), mk(25, true), mk(8, false), mk(1, true), mk(44, false),
    ];
    const out = sortArrivalsByEta(mixed);
    expect(out.map((a) => a.eta)).toEqual([1, 3, 8, 12, 25, 44]);
  });

  it("ya ordenada se mantiene", () => {
    const asc = [mk(0, true), mk(5, true), mk(9, false), mk(30, false)];
    expect(sortArrivalsByEta(asc).map((a) => a.eta)).toEqual([0, 5, 9, 30]);
  });

  it("NaN/Infinity van al final sin desordenar los válidos (guard de finitud)", () => {
    const bad = [
      mk(20, true), mk(NaN, true), mk(5, false), mk(Infinity, true), mk(12, true),
    ];
    const out = sortArrivalsByEta(bad);
    // los finitos, en orden; los no-finitos al final
    expect(out.slice(0, 3).map((a) => a.eta)).toEqual([5, 12, 20]);
    expect(out.slice(3).every((a) => !Number.isFinite(a.eta))).toBe(true);
  });

  it("estable en empates: a igual minuto conserva el orden de entrada (vivo antes que horario)", () => {
    const ties = [mk(10, true, "VIVO"), mk(10, false, "HORARIO"), mk(10, true, "VIVO2")];
    const out = sortArrivalsByEta(ties);
    expect(out.map((a) => a.lineName)).toEqual(["VIVO", "HORARIO", "VIVO2"]);
  });

  it("no muta el array original", () => {
    const orig = [mk(9, true), mk(2, true)];
    sortArrivalsByEta(orig);
    expect(orig.map((a) => a.eta)).toEqual([9, 2]);
  });
});
