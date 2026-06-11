/**
 * Modo frío — lógica pura de selección de alternativas (lib/cold-mode).
 * Reglas de honestidad: solo líneas que NO pasan acá, solo alcanzables caminando,
 * solo si el ahorro es real.
 */
import { describe, it, expect } from "vitest";
import { isColdWait, pickColdAlternatives, COLD_THRESHOLD_MIN, type AltStopInput } from "@/lib/cold-mode";

function alt(over: Partial<AltStopInput> = {}): AltStopInput {
  return {
    stopId: "9001",
    stopName: "AV ITALIA y COMERCIO",
    distM: 120, // walkingMinutes(120) = ceil(156/75) = 3 min a pie
    arrivals: [{ line: "405", destination: "PORTONES", etaMin: 6, isScheduled: false }],
    ...over,
  };
}

describe("isColdWait", () => {
  it("sin llegadas (null) → frío", () => {
    expect(isColdWait(null)).toBe(true);
  });

  it("espera larga (> umbral) → frío; corta → no", () => {
    expect(isColdWait(COLD_THRESHOLD_MIN + 1)).toBe(true);
    expect(isColdWait(COLD_THRESHOLD_MIN)).toBe(false);
    expect(isColdWait(3)).toBe(false);
  });
});

describe("pickColdAlternatives", () => {
  it("espera corta acá → nunca sugiere (aunque haya alternativas)", () => {
    expect(pickColdAlternatives(5, [], [alt()])).toEqual([]);
  });

  it("espera de 20 min acá → sugiere el 405 a 120 m que llega en 6", () => {
    const out = pickColdAlternatives(20, ["103"], [alt()]);
    expect(out).toHaveLength(1);
    expect(out[0].line).toBe("405");
    expect(out[0].etaMin).toBe(6);
    expect(out[0].walkMin).toBe(3);
  });

  it("excluye líneas que pasan por la parada actual (sentido contrario probable)", () => {
    const out = pickColdAlternatives(20, ["405"], [alt()]);
    expect(out).toEqual([]);
  });

  it("excluye buses inalcanzables (llegan antes de que termines de caminar)", () => {
    const a = alt({ arrivals: [{ line: "405", destination: "PORTONES", etaMin: 2, isScheduled: false }] });
    expect(pickColdAlternatives(20, [], [a])).toEqual([]);
  });

  it("acepta el caso límite eta == caminata (llegás justo)", () => {
    const a = alt({ arrivals: [{ line: "405", destination: "PORTONES", etaMin: 3, isScheduled: false }] });
    const out = pickColdAlternatives(20, [], [a]);
    expect(out).toHaveLength(1);
  });

  it("exige ahorro real: con 20 min acá, una alternativa a 17 no vale la caminata", () => {
    const a = alt({ arrivals: [{ line: "405", destination: "PORTONES", etaMin: 17, isScheduled: false }] });
    expect(pickColdAlternatives(20, [], [a])).toEqual([]);
    // a 15 sí (15 + 5 <= 20)
    const b = alt({ arrivals: [{ line: "405", destination: "PORTONES", etaMin: 15, isScheduled: false }] });
    expect(pickColdAlternatives(20, [], [b])).toHaveLength(1);
  });

  it("sin llegadas acá: sugiere hasta 25 min, no más (un horario a 40 min no es alternativa)", () => {
    const ok = alt({ arrivals: [{ line: "405", destination: "PORTONES", etaMin: 25, isScheduled: true }] });
    const far = alt({ stopId: "9002", arrivals: [{ line: "117", destination: "CENTRO", etaMin: 26, isScheduled: true }] });
    const out = pickColdAlternatives(null, [], [ok, far]);
    expect(out).toHaveLength(1);
    expect(out[0].line).toBe("405");
    expect(out[0].isScheduled).toBe(true);
  });

  it("deduplica por línea (se queda con el menor ETA), ordena por ETA y limita a 2", () => {
    const a = alt({
      stopId: "9001",
      arrivals: [
        { line: "405", destination: "PORTONES", etaMin: 9, isScheduled: false },
        { line: "117", destination: "CENTRO", etaMin: 7, isScheduled: false },
      ],
    });
    const b = alt({
      stopId: "9002",
      distM: 200,
      arrivals: [
        { line: "405", destination: "PORTONES", etaMin: 6, isScheduled: false }, // gana al 9
        { line: "60", destination: "ADUANA", etaMin: 12, isScheduled: false },   // 3ro → queda fuera
      ],
    });
    const out = pickColdAlternatives(20, [], [a, b]);
    expect(out).toHaveLength(2);
    expect(out[0].line).toBe("405");
    expect(out[0].etaMin).toBe(6);
    expect(out[0].stopId).toBe("9002");
    expect(out[1].line).toBe("117");
  });

  it("descarta ETAs no finitas (NaN/Infinity de datos rotos)", () => {
    const a = alt({ arrivals: [{ line: "405", destination: "PORTONES", etaMin: NaN, isScheduled: false }] });
    expect(pickColdAlternatives(20, [], [a])).toEqual([]);
  });
});
