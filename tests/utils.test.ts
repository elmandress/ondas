import { describe, it, expect, vi, afterEach } from "vitest";
import { formatRelativeTime, formatEta, titleCaseDestination, leaveNowUrgency, atStopUrgency } from "@/lib/utils";

describe("titleCaseDestination (R58 — destinos STM en mayúsculas → legibles)", () => {
  it("convierte destinos del STM a Title Case con conectores en minúscula", () => {
    expect(titleCaseDestination("PUNTA CARRETAS (POR PARQUE)")).toBe("Punta Carretas (por Parque)");
    expect(titleCaseDestination("CIUDAD VIEJA")).toBe("Ciudad Vieja");
    expect(titleCaseDestination("BARRA DEL SANTA LUCIA")).toBe("Barra del Santa Lucia");
  });

  it("respeta siglas uruguayas conocidas", () => {
    expect(titleCaseDestination("PUNTA CARRETAS (POR UTU CERRO)")).toBe("Punta Carretas (por UTU Cerro)");
    expect(titleCaseDestination("HOSPITAL DEL BPS")).toBe("Hospital del BPS");
  });

  it("el primer término nunca queda en minúscula aunque sea conector", () => {
    expect(titleCaseDestination("LA TEJA")).toBe("La Teja");
    expect(titleCaseDestination("EL PINAR")).toBe("El Pinar");
  });

  it("no toca texto que ya viene con minúsculas (interior/geocoder)", () => {
    expect(titleCaseDestination("Terminal Tres Cruces")).toBe("Terminal Tres Cruces");
    expect(titleCaseDestination("")).toBe("");
  });
});

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

  it("compacto: <60 min igual; >=60 colapsa a 'Xh+' (chips angostos del hero)", () => {
    expect(formatEta(45, false, true)).toBe("45 min"); // corto no cambia
    expect(formatEta(90, false, true)).toBe("1h+");     // 1h 30m → 1h+
    expect(formatEta(114, false, true)).toBe("1h+");    // 1h 54m → 1h+
    expect(formatEta(125, false, true)).toBe("2h+");
    expect(formatEta(90, true, true)).toBe("~1h+");     // approx + compacto
  });
});

describe("urgencia del hero (A4 atStop + Bug B leave)", () => {
  // A4: en la parada (atStop=true) la urgencia sale de la LLEGADA del bus.
  it("atStopUrgency: la urgencia es por ETA del bus (atStop)", () => {
    expect(atStopUrgency(0)).toBe("now");
    expect(atStopUrgency(1)).toBe("now");
    expect(atStopUrgency(2)).toBe("soon");
    expect(atStopUrgency(5)).toBe("soon");
    expect(atStopUrgency(6)).toBe("chill");
    expect(atStopUrgency(20)).toBe("chill");
  });

  // Bug B: el cálculo de SALIR (no-atStop) queda intacto — mismo escalón pero sobre
  // el tiempo de salida (leaveInMin), no el ETA del bus. Que no se reabra.
  it("leaveNowUrgency: sin tocar (Bug B) — urgencia por tiempo de salida", () => {
    expect(leaveNowUrgency(1)).toBe("now");
    expect(leaveNowUrgency(5)).toBe("soon");
    expect(leaveNowUrgency(6)).toBe("chill");
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
