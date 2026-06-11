/**
 * Tarifas — foco en boletosFromSaldo (pantalla Saldo STM): cuántos viajes rinde
 * un saldo. Debe ser honesto con basura (null) y no asumir 0 viajes ante NaN.
 */
import { describe, it, expect } from "vitest";
import { boletosFromSaldo, URBAN_FARES } from "@/lib/fare";

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
