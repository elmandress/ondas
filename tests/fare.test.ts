/**
 * Tarifas — foco en boletosFromSaldo (pantalla Saldo STM): cuántos viajes rinde
 * un saldo. Debe ser honesto con basura (null) y no asumir 0 viajes ante NaN.
 */
import { describe, it, expect } from "vitest";
import { boletosFromSaldo, estimateFare, suburbanFareForKm, URBAN_FARES, SUBURBAN_FARES } from "@/lib/fare";

describe("boletosFromSaldo", () => {
  const fare = URBAN_FARES.hora_stm; // boleto común con tarjeta

  it("divide el saldo por el boleto común (piso)", () => {
    expect(boletosFromSaldo(fare * 3)).toBe(3);
    expect(boletosFromSaldo(fare * 3 + 10)).toBe(3); // sobra plata, no alcanza otro
    expect(boletosFromSaldo(fare - 1)).toBe(0);      // no te alcanza ni uno
  });

  it("saldo 0 → 0 boletos (no null: es un saldo válido)", () => {
    expect(boletosFromSaldo(0)).toBe(0);
  });

  it("entradas inválidas → null (no '0 boletos' ante basura)", () => {
    expect(boletosFromSaldo(NaN)).toBeNull();
    expect(boletosFromSaldo(Infinity)).toBeNull();
    expect(boletosFromSaldo(-50)).toBeNull();
  });

  it("exactamente un boleto", () => {
    expect(boletosFromSaldo(fare)).toBe(1);
  });
});

describe("estimateFare — tarifa suburbana por TRAMO de distancia (fix R71)", () => {
  it("urbano: sin cambios, no usa distancia", () => {
    const f = estimateFare(0, false);
    expect(f.cash).toBe(URBAN_FARES.hora_efectivo);
    expect(f.suburban).toBe(false);
  });

  // El "intra-MVD" (incluso 25 km dentro de MVD) NO llega como suburban=true: el planner
  // rutea los viajes intra-MVD por líneas urbanas (bloquea las metro). Se cobra URBANO.
  it("intra-MVD (cualquier distancia) es URBANO, no el $86 suburbano", () => {
    expect(estimateFare(0, false, 25).cash).toBe(URBAN_FARES.hora_efectivo);
  });

  it("suburbano ≤32 km → $107 (era $86: subreporte)", () => {
    expect(estimateFare(0, true, 10).cash).toBe(SUBURBAN_FARES.hasta_32km);
    expect(estimateFare(0, true, 32).cash).toBe(SUBURBAN_FARES.hasta_32km);
  });

  it("suburbano 32–40 km → $127", () => {
    expect(estimateFare(0, true, 35).cash).toBe(SUBURBAN_FARES.hasta_40km);
    expect(estimateFare(0, true, 40).cash).toBe(SUBURBAN_FARES.hasta_40km);
  });

  it("suburbano >40 km (Canelones lejos) → $153, NUNCA el viejo $86", () => {
    expect(estimateFare(0, true, 50).cash).toBe(SUBURBAN_FARES.hasta_60km);
    expect(estimateFare(0, true, 50).cash).not.toBe(SUBURBAN_FARES.dentro_mvd);
  });

  it("suburbano sin distancia → tramo base de salir ($107), no el mínimo intra-MVD ($86)", () => {
    expect(estimateFare(0, true).cash).toBe(SUBURBAN_FARES.hasta_32km);
    expect(suburbanFareForKm(NaN)).toBe(SUBURBAN_FARES.hasta_32km);
    expect(suburbanFareForKm(undefined)).toBe(SUBURBAN_FARES.hasta_32km);
  });
});
