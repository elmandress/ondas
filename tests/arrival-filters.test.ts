import { describe, it, expect } from "vitest";
import { isAccessibleArrival, arrivalHasAc } from "@/lib/stm";

describe("arrival filters (accesible / aire)", () => {
  it("isAccessibleArrival: piso bajo y plataforma → true; resto → false", () => {
    expect(isAccessibleArrival({ access: "PISO BAJO" })).toBe(true);
    expect(isAccessibleArrival({ access: "PLATAFORMA ELEVADORA" })).toBe(true);
    expect(isAccessibleArrival({ access: "PISO ALTO" })).toBe(false);
    expect(isAccessibleArrival({ access: undefined })).toBe(false);
  });

  it("arrivalHasAc: solo 'Aire Acondicionado' → true", () => {
    expect(arrivalHasAc({ thermalConfort: "Aire Acondicionado" })).toBe(true);
    expect(arrivalHasAc({ thermalConfort: "Sin datos" })).toBe(false);
    expect(arrivalHasAc({ thermalConfort: undefined })).toBe(false);
  });
});
