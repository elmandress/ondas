import { describe, it, expect, vi, afterEach } from "vitest";
import { formatRelativeTime } from "@/lib/utils";

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
