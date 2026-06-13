import { describe, it, expect } from "vitest";
import { getLineHoursLookup, getTipoDia, getMainServiceWindow } from "@/lib/line-hours";

// Convención de hora MVD en tests: getLineHoursLookup y getTipoDia usan getUTCHours/getUTCDay
// sobre fechas MVD-ajustadas (UTC-3 permanente). Para representar "X:00 MVD", pasar
// new Date("YYYY-MM-DDT{X}:00:00Z") — el valor UTC de la fecha = la hora MVD deseada.
// Ejemplo: "12:00 MVD lunes" → new Date("2026-05-25T12:00:00Z")
function mvdDate(isoLocalMvd: string): Date {
  // isoLocalMvd está en hora MVD (sin Z). Construimos la fecha UTC-ajustada para tests.
  // "2026-05-25T12:00" → Date con UTC=12:00 (= hora MVD en la convención interna).
  return new Date(`${isoLocalMvd}Z`);
}

describe("line-hours", () => {
  it("getTipoDia mapea correctamente: 1=hábil, 2=sab, 3=dom", () => {
    expect(getTipoDia(mvdDate("2026-05-25T10:00"))).toBe(1); // lunes
    expect(getTipoDia(mvdDate("2026-05-30T10:00"))).toBe(2); // sábado
    expect(getTipoDia(mvdDate("2026-05-31T10:00"))).toBe(3); // domingo
  });

  it("línea 495 (nocturno/horario reducido) NO opera al mediodía hábil", () => {
    // Lunes 12:00 MVD — la 495 según samples no opera en este horario
    const lookup = getLineHoursLookup(mvdDate("2026-05-25T12:00"));
    if (!lookup.hasData("495")) {
      console.warn("línea 495 sin datos — skip");
      return;
    }
    expect(lookup.operatesNowOrSoon("495", 60)).toBe(false);
  });

  it("línea 183 (regular todo el día) SÍ opera al mediodía hábil", () => {
    const lookup = getLineHoursLookup(mvdDate("2026-05-25T12:00"));
    if (!lookup.hasData("183")) return;
    expect(lookup.operatesNowOrSoon("183", 60)).toBe(true);
  });

  it("línea inexistente devuelve true (fail open — no filtrar lo que no sabemos)", () => {
    const lookup = getLineHoursLookup(mvdDate("2026-05-25T12:00"));
    expect(lookup.operatesNowOrSoon("XXX_FAKE_999", 60)).toBe(true);
  });

  it("ventana cruzando medianoche funciona (23:30 + 90 min cubre 00:00 del día siguiente)", () => {
    const lookup = getLineHoursLookup(mvdDate("2026-05-25T23:30"));
    if (!lookup.hasData("183")) return;
    // 183 opera 23:15-24:00 → debe encontrar servicio
    expect(lookup.operatesNowOrSoon("183", 90)).toBe(true);
  });
});

// R62b: ventana PRINCIPAL (bloque contiguo) en vez del span primer-último.
describe("getMainServiceWindow", () => {
  it("una línea con datos da un bloque con HH:MM válidos y first<last", () => {
    const w = getMainServiceWindow("183", 1);
    if (!w) return; // sin datos en el entorno → nada que validar
    expect(w.first).toMatch(/^\d\d:\d\d$/);
    expect(w.last).toMatch(/^\d\d:\d\d$/);
    expect(typeof w.outliers).toBe("boolean");
    // el inicio del bloque principal no debe ser después del fin
    expect(w.first <= w.last || w.last === "24:00").toBe(true);
  });

  it("línea inexistente → null", () => {
    expect(getMainServiceWindow("XXX_FAKE_999", 1)).toBeNull();
  });
});
