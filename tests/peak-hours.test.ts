import { describe, it, expect } from "vitest";
import { getPeakStatus } from "@/lib/peak-hours";

// Fechas con offset EXPLÍCITO -03:00 (hora de Montevideo) para que el test sea
// determinístico sin importar la zona horaria donde corra el CI.
// 2026-05-25 = lunes (hábil); 2026-05-30 = sábado.

describe("peak-hours (hora pico Montevideo)", () => {
  it("lunes 08:00 → pico de la mañana", () => {
    const s = getPeakStatus(new Date("2026-05-25T08:00:00-03:00"));
    expect(s.isPeak).toBe(true);
    expect(s.kind).toBe("morning");
  });

  it("lunes 18:30 → pico de la tarde", () => {
    const s = getPeakStatus(new Date("2026-05-25T18:30:00-03:00"));
    expect(s.isPeak).toBe(true);
    expect(s.kind).toBe("evening");
  });

  it("lunes 12:00 (mediodía) → sin pico", () => {
    expect(getPeakStatus(new Date("2026-05-25T12:00:00-03:00")).isPeak).toBe(false);
  });

  it("bordes: 09:00 y 20:00 quedan fuera (ventanas semiabiertas)", () => {
    expect(getPeakStatus(new Date("2026-05-25T09:00:00-03:00")).isPeak).toBe(false);
    expect(getPeakStatus(new Date("2026-05-25T20:00:00-03:00")).isPeak).toBe(false);
    expect(getPeakStatus(new Date("2026-05-25T06:59:00-03:00")).isPeak).toBe(false);
  });

  it("sábado 08:00 → sin pico (fin de semana)", () => {
    expect(getPeakStatus(new Date("2026-05-30T08:00:00-03:00")).isPeak).toBe(false);
  });
});
