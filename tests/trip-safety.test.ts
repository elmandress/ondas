import { describe, it, expect } from "vitest";
import { nightExposure, isOnAvenue, assessTripSafety, saferAlternative, type SafetyTrip } from "@/lib/trip-safety";

// Montevideo = UTC-3 todo el año. Para fijar una hora local uso UTC + 3.
const at = (mvdHour: number) => new Date(Date.UTC(2026, 5, 3, (mvdHour + 3) % 24, 0, 0));

describe("trip-safety · hora granular", () => {
  it("día = factor 0; madrugada = factor 1; anochecer intermedio", () => {
    expect(nightExposure(at(14)).factor).toBe(0);
    expect(nightExposure(at(3)).factor).toBe(1);
    expect(nightExposure(at(20)).phase).toBe("dusk");
    expect(nightExposure(at(23)).factor).toBeGreaterThan(0.5);
  });
});

describe("trip-safety · detección de avenida", () => {
  it("reconoce avenidas y bulevares; calle interna = false", () => {
    expect(isOnAvenue("Av Italia y Propios")).toBe(true);
    expect(isOnAvenue("Bvar Artigas")).toBe(true);
    expect(isOnAvenue("8 de Octubre - Garibaldi")).toBe(true);
    expect(isOnAvenue("Cno Maldonado")).toBe(true);
    expect(isOnAvenue("Pedro Berro y Solano García")).toBe(false);
    expect(isOnAvenue(undefined)).toBe(false);
  });
});

// Caminata larga que termina en Casavalle (zona de precaución), por calle interna
// (nombres deliberadamente NO-avenida para probar el peor caso a pie).
const tripZoneNight: SafetyTrip = {
  numTransfers: 0,
  legs: [
    { type: "bus", distanceM: 5000, durationS: 1200, fromStopName: "Av 18 de Julio", toStopName: "Cno los Aromos" },
    { type: "walk", distanceM: 800, durationS: 640, fromStopName: "Cno los Aromos", toStopName: "Pasaje interno", polyline: [[-34.83, -56.17], [-34.8289, -56.1688]] },
  ],
};

describe("trip-safety · recomendación contextual", () => {
  it("de DÍA no molesta aunque la caminata sea larga", () => {
    const a = assessTripSafety(tripZoneNight, at(14));
    expect(a.level).toBe("none");
  });

  it("de MADRUGADA + zona poco transitada + calle interna → recomienda taxi en ESE tramo", () => {
    const a = assessTripSafety(tripZoneNight, at(3));
    expect(a.level).toBe("recommend");
    expect(a.action?.kind).toBe("taxi-leg");
    expect(a.action?.legIndex).toBe(1); // el walk leg, no el bus
    expect(a.detail).not.toMatch(/casavalle|peligros/i); // sin nombrar barrio ni "peligroso"
  });

  it("si la caminata va por AVENIDA, tranquiliza en vez de asustar", () => {
    const trip: SafetyTrip = {
      numTransfers: 0,
      legs: [
        { type: "bus", distanceM: 4000, durationS: 1000 },
        { type: "walk", distanceM: 700, durationS: 560, fromStopName: "Av Italia", toStopName: "Av Italia y Pereira", polyline: [[-34.91, -56.14], [-34.911, -56.142]] },
      ],
    };
    const a = assessTripSafety(trip, at(23));
    expect(a.level).toBe("info");
    expect(a.headline.toLowerCase()).toMatch(/avenida/);
  });
});

describe("trip-safety · alternativa más segura", () => {
  it("elige una ruta apenas más larga con mucha menos caminata nocturna", () => {
    const corta = tripZoneNight; // 800 m a pie de noche en zona
    const larga: SafetyTrip = {
      numTransfers: 1,
      legs: [
        { type: "bus", distanceM: 5200, durationS: 1300 },
        { type: "walk", distanceM: 150, durationS: 120, fromStopName: "Av Gral Flores", toStopName: "destino", polyline: [[-34.85, -56.18], [-34.851, -56.181]] },
      ],
    };
    const pick = saferAlternative([corta, larga], [1840, 2300], 0, at(3));
    expect(pick?.idx).toBe(1);
    expect(pick!.savedWalkM).toBeGreaterThanOrEqual(250);
    expect(pick!.extraMin).toBeLessThanOrEqual(12);
  });

  it("de día no sugiere alternativa por seguridad", () => {
    expect(saferAlternative([tripZoneNight, tripZoneNight], [1840, 2000], 0, at(14))).toBeNull();
  });
});

// R62: el chip "caminás N m de noche" del resumen depende de nightWalkM + level.
// Congela el contrato que usa GtfsRouteCard (umbral 450 m; de día = none).
describe("trip-safety · chip de exposición nocturna (resumen de ruta)", () => {
  it("caminata larga de noche al destino → nightWalkM ≥ umbral y level accionable", () => {
    const trip: SafetyTrip = {
      numTransfers: 0,
      legs: [
        { type: "walk", distanceM: 120, durationS: 100, fromStopName: "origen", toStopName: "parada", polyline: [[-34.90, -56.18], [-34.901, -56.181]] },
        { type: "bus", distanceM: 4000, durationS: 1000 },
        { type: "walk", distanceM: 650, durationS: 520, fromStopName: "parada", toStopName: "destino", polyline: [[-34.86, -56.17], [-34.862, -56.172]] },
      ],
    };
    const a = assessTripSafety(trip, at(23));
    expect(a.nightWalkM).toBeGreaterThanOrEqual(450);
    expect(["soft", "recommend"]).toContain(a.level);
  });

  it("de día el mismo viaje no dispara el chip (level none, nightWalkM 0)", () => {
    const trip: SafetyTrip = {
      numTransfers: 0,
      legs: [
        { type: "bus", distanceM: 4000, durationS: 1000 },
        { type: "walk", distanceM: 650, durationS: 520, fromStopName: "parada", toStopName: "destino", polyline: [[-34.86, -56.17], [-34.862, -56.172]] },
      ],
    };
    const a = assessTripSafety(trip, at(14));
    expect(a.level).toBe("none");
    expect(a.nightWalkM).toBe(0);
  });
});
