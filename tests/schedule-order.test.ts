import { describe, it, expect } from "vitest";
import { minutesInWindow } from "@/lib/schedule-db";

/**
 * P0 (R73): orden cronológico de horarios programados al cruzar medianoche.
 *
 * Bug confirmado con datos reales (stop 1122, línea 76, 23:50): el pager mostraba
 * 00:24, 00:55, 03:02 … y el bus a 2 min (23:52) ÚLTIMO. Causa: el packed está asc por
 * minuto-de-día (0-1439); el +1440 del cruce de medianoche desordena la salida si no se
 * re-ordena. Este test fija el caso para que no vuelva.
 */
describe("minutesInWindow — orden cronológico cruzando medianoche", () => {
  it("ordena 23:52 antes que 00:24/00:55 (no por el minuto-de-día raw)", () => {
    // packed = 00:24, 00:55, 23:52 (minutos de día). Ventana a las 23:50 (1430): [1428, 1910].
    const out = minutesInWindow("24,55,1432", 1428, 1430 + 480);
    // 23:52 → 1432 (a 2 min); 00:24 → 1464 (+34); 00:55 → 1495 (+65). Cronológico:
    expect(out).toEqual([1432, 1464, 1495]);
    // El primero es el más próximo (no 1464 como en el bug).
    expect(out[0]).toBe(1432);
  });

  it("no rompe el caso intra-día (sin cruce)", () => {
    // 10:00, 10:30, 11:00 a las 9:50 (590): ventana [588, 1070]. Sin +1440.
    expect(minutesInWindow("600,630,660", 588, 1070)).toEqual([600, 630, 660]);
  });

  it("excluye lo que quedó fuera de la ventana (pasados / muy lejanos)", () => {
    // a las 12:00 (720), ventana [718, 1200]: 11:00 (660) ya pasó, 21:00 (1260) muy lejos.
    expect(minutesInWindow("660,720,1260", 718, 1200)).toEqual([720]);
  });
});
