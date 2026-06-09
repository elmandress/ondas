import { describe, it, expect, vi, afterEach } from "vitest";
import { formatRelativeTime, formatEta } from "@/lib/utils";

describe("formatEta", () => {
  it("retorna 'Ahora' para 0 y negativo", () => {
    expect(formatEta(0)).toBe("Ahora");
    expect(formatEta(-5)).toBe("Ahora");
    expect(formatEta(-999)).toBe("Ahora");
  });

  it("retorna '~Ya' para approx=true con valor 0 o negativo", () => {
    expect(formatEta(0, true)).toBe("~Ya");
    expect(formatEta(-1, true)).toBe("~Ya");
  });

  it("retorna 'Ahora' para NaN — regresión crash (era 'NaN min')", () => {
    expect(formatEta(NaN)).toBe("Ahora");
    expect(formatEta(NaN, true)).toBe("~Ya");
  });

  it("retorna 'Ahora' para Infinity — regresión crash (era 'Infinityh NaNm')", () => {
    expect(formatEta(Infinity)).toBe("Ahora");
    expect(formatEta(-Infinity)).toBe("Ahora");
  });

  it("redondea fracciones — regresión (99.5 era '1h 39.5m')", () => {
    expect(formatEta(99.5)).toBe("1h 40m");
    expect(formatEta(59.9)).toBe("1h");
    expect(formatEta(1.4)).toBe("1 min");
  });

  it("minutos enteros normales", () => {
    expect(formatEta(1)).toBe("1 min");
    expect(formatEta(5)).toBe("5 min");
    expect(formatEta(59)).toBe("59 min");
  });

  it("horas exactas y con minutos", () => {
    expect(formatEta(60)).toBe("1h");
    expect(formatEta(90)).toBe("1h 30m");
    expect(formatEta(120)).toBe("2h");
  });

  it("approx agrega tilde", () => {
    expect(formatEta(5, true)).toBe("~5 min");
    expect(formatEta(90, true)).toBe("~1h 30m");
  });
});

describe("formatRelativeTime", () => {
  afterEach(() => vi.useRealTimers());

  function fakeNow(ms: number, offset: number) {
    vi.useFakeTimers();
    vi.setSystemTime(ms);
    return new Date(ms - offset * 1000);
  }

  it("devuelve 'recién' para datos de hace menos de 10 s", () => {
    const now = Date.now();
    vi.useFakeTimers(); vi.setSystemTime(now);
    expect(formatRelativeTime(new Date(now - 5_000))).toBe("recién");
    expect(formatRelativeTime(new Date(now - 9_000))).toBe("recién");
  });

  it("devuelve 'recién' para fecha exactamente igual a ahora", () => {
    const now = Date.now();
    vi.useFakeTimers(); vi.setSystemTime(now);
    expect(formatRelativeTime(new Date(now))).toBe("recién");
  });

  it("devuelve 'recién' para fecha FUTURA (sec negativo)", () => {
    const now = Date.now();
    vi.useFakeTimers(); vi.setSystemTime(now);
    expect(formatRelativeTime(new Date(now + 60_000))).toBe("recién");
    expect(formatRelativeTime(new Date(now + 3_600_000))).toBe("recién");
  });

  it("devuelve 'recién' para Date inválida (NaN) — regresión crash", () => {
    // new Date(NaN).getTime() === NaN → sin este fix retornaba "hace NaN h"
    expect(formatRelativeTime(new Date(NaN))).toBe("recién");
  });

  it("devuelve segundos entre 10 s y 59 s", () => {
    const d = fakeNow(Date.now(), 30);
    expect(formatRelativeTime(d)).toBe("hace 30 s");
  });

  it("devuelve minutos entre 60 s y 59 min", () => {
    const d1 = fakeNow(Date.now(), 90);   // 1.5 min → 2 min (round)
    expect(formatRelativeTime(d1)).toBe("hace 2 min");

    const d2 = fakeNow(Date.now(), 60);
    expect(formatRelativeTime(d2)).toBe("hace 1 min");

    const d3 = fakeNow(Date.now(), 3540); // 59 min
    expect(formatRelativeTime(d3)).toBe("hace 59 min");
  });

  it("devuelve horas para >= 60 min", () => {
    const d1 = fakeNow(Date.now(), 3600);  // 1 h
    expect(formatRelativeTime(d1)).toBe("hace 1 h");

    const d2 = fakeNow(Date.now(), 7200);  // 2 h
    expect(formatRelativeTime(d2)).toBe("hace 2 h");
  });
});
