import { describe, it, expect } from "vitest";
import { isCautionNightZone, walkAdvisory } from "@/lib/safety-zones";

describe("safety-zones", () => {
  it("detecta un punto dentro de una zona marcada (Casavalle) y fuera (Pocitos)", () => {
    expect(isCautionNightZone(-34.8289, -56.1688)).toBe(true); // Casavalle centro
    expect(isCautionNightZone(-34.9120, -56.1560)).toBe(false); // Pocitos (no marcada)
  });

  it("walkAdvisory: de noche en zona marcada con caminata ≥500m → recommend", () => {
    expect(walkAdvisory(600, -34.8289, -56.1688, true)).toBe("recommend");
  });

  it("walkAdvisory: tramos <500m nunca sugieren taxi (ni en zona de noche)", () => {
    expect(walkAdvisory(150, -34.8289, -56.1688, true)).toBe("none");
    expect(walkAdvisory(450, -34.8289, -56.1688, true)).toBe("none");
  });

  it("walkAdvisory: de noche, caminata larga fuera de zona → soft", () => {
    expect(walkAdvisory(700, -34.9120, -56.1560, true)).toBe("soft");
  });

  it("walkAdvisory: de día y tramo corto → none", () => {
    expect(walkAdvisory(200, -34.9120, -56.1560, false)).toBe("none");
    expect(walkAdvisory(600, -34.8289, -56.1688, false)).toBe("none"); // zona pero de día → none salvo caminata muy larga
  });
});
