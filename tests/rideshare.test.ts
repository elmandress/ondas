import { describe, it, expect } from "vitest";
import { uberDeepLink, isNightTariff } from "@/lib/rideshare";

describe("rideshare", () => {
  it("uberDeepLink arma un universal link con pickup y dropoff", () => {
    const url = uberDeepLink({ lat: -34.9058, lon: -56.1882 }, { lat: -34.8889, lon: -56.0758 }, "Portones Shopping");
    expect(url).toContain("https://m.uber.com/ul/");
    expect(url).toContain("action=setPickup");
    expect(url).toContain("pickup%5Blatitude%5D=-34.905800");
    expect(url).toContain("dropoff%5Blongitude%5D=-56.075800");
    expect(url).toContain("Portones+Shopping");
  });

  it("isNightTariff detecta franja nocturna 22–06 (Montevideo)", () => {
    expect(isNightTariff(new Date("2026-05-25T23:30:00-03:00"))).toBe(true);
    expect(isNightTariff(new Date("2026-05-25T03:00:00-03:00"))).toBe(true);
    expect(isNightTariff(new Date("2026-05-25T14:00:00-03:00"))).toBe(false);
  });
});
