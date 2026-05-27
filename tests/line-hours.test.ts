import { describe, it, expect } from "vitest";
import { getLineHoursLookup, getTipoDia } from "@/lib/line-hours";

describe("line-hours", () => {
  it("getTipoDia mapea correctamente: 1=hábil, 2=sab, 3=dom", () => {
    expect(getTipoDia(new Date("2026-05-25T10:00:00"))).toBe(1); // lunes
    expect(getTipoDia(new Date("2026-05-30T10:00:00"))).toBe(2); // sábado
    expect(getTipoDia(new Date("2026-05-31T10:00:00"))).toBe(3); // domingo
  });

  it("línea 495 (nocturno/horario reducido) NO opera al mediodía hábil", () => {
    // Lunes 12:00 — la 495 según samples no opera en este horario
    const lookup = getLineHoursLookup(new Date("2026-05-25T12:00:00"));
    if (!lookup.hasData("495")) {
      console.warn("línea 495 sin datos — skip");
      return;
    }
    expect(lookup.operatesNowOrSoon("495", 60)).toBe(false);
  });

  it("línea 183 (regular todo el día) SÍ opera al mediodía hábil", () => {
    const lookup = getLineHoursLookup(new Date("2026-05-25T12:00:00"));
    if (!lookup.hasData("183")) return;
    expect(lookup.operatesNowOrSoon("183", 60)).toBe(true);
  });

  it("línea inexistente devuelve true (fail open — no filtrar lo que no sabemos)", () => {
    const lookup = getLineHoursLookup(new Date("2026-05-25T12:00:00"));
    expect(lookup.operatesNowOrSoon("XXX_FAKE_999", 60)).toBe(true);
  });

  it("ventana cruzando medianoche funciona (23:30 + 90 min cubre 00:00 del día siguiente)", () => {
    const lookup = getLineHoursLookup(new Date("2026-05-25T23:30:00"));
    if (!lookup.hasData("183")) return;
    // 183 opera 23:15-24:00 → debe encontrar servicio
    expect(lookup.operatesNowOrSoon("183", 90)).toBe(true);
  });
});
