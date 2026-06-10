/**
 * Validación de inputs en los API routes — probamos la lógica de guardia
 * directamente sin levantar un servidor HTTP.
 */
import { describe, it, expect } from "vitest";

// ── helpers que replican la lógica de los endpoints ──────────────────────────

function validateStopId(stopId: string | null): boolean {
  return !!stopId && stopId.length <= 30;
}

function validateGeocode(q: string | null | undefined): boolean {
  if (!q) return false;
  const t = q.trim();
  return t.length >= 1 && t.length <= 300;
}

function validateLineIds(raw: string | null): string[] {
  if (!raw) return [];
  return raw.split(",").filter(Boolean).slice(0, 20);
}

function validateDepartAt(departAt: unknown): Date | undefined {
  if (typeof departAt !== "string") return undefined;
  const d = new Date(departAt);
  if (isNaN(d.getTime())) return undefined;
  if (d.getTime() < Date.now() - 24 * 60 * 60 * 1000) return undefined;
  return d;
}

// ── arrivals stopId ───────────────────────────────────────────────────────────

describe("arrivals — stopId validation", () => {
  it("acepta stopId normal", () => {
    expect(validateStopId("3790")).toBe(true);
    expect(validateStopId("M12")).toBe(true);
    expect(validateStopId("00001")).toBe(true);
  });

  it("rechaza stopId null", () => {
    expect(validateStopId(null)).toBe(false);
  });

  it("rechaza stopId vacío", () => {
    expect(validateStopId("")).toBe(false);
  });

  it("rechaza stopId demasiado largo (> 30 chars)", () => {
    expect(validateStopId("1".repeat(31))).toBe(false);
    expect(validateStopId("1".repeat(100))).toBe(false);
  });

  it("acepta stopId en el límite exacto de 30 chars", () => {
    expect(validateStopId("1".repeat(30))).toBe(true);
  });
});

// ── geocode q ─────────────────────────────────────────────────────────────────

describe("geocode — q validation", () => {
  it("acepta query normal", () => {
    expect(validateGeocode("Tres Cruces")).toBe(true);
    expect(validateGeocode("A")).toBe(true);
  });

  it("rechaza query null / undefined / vacío", () => {
    expect(validateGeocode(null)).toBe(false);
    expect(validateGeocode(undefined)).toBe(false);
    expect(validateGeocode("")).toBe(false);
    expect(validateGeocode("   ")).toBe(false);
  });

  it("rechaza query demasiado largo (> 300 chars)", () => {
    expect(validateGeocode("a".repeat(301))).toBe(false);
    expect(validateGeocode("a".repeat(10_000))).toBe(false);
  });

  it("acepta query en el límite exacto de 300 chars", () => {
    expect(validateGeocode("a".repeat(300))).toBe(true);
  });
});

// ── vehicles lineIds ──────────────────────────────────────────────────────────

function validateLineIdsParam(raw: string | null): string[] | undefined {
  // Replica la lógica actual de vehicles/route.ts (incluye el guard de longitud)
  if (!raw) return undefined;
  if (raw.length > 200) return undefined;
  return raw.split(",").filter(Boolean).slice(0, 20);
}

describe("vehicles — lineIds limit (VEH-1)", () => {
  it("acepta hasta 20 lineIds", () => {
    const param = Array.from({ length: 20 }, (_, i) => String(i + 1)).join(",");
    const ids = validateLineIdsParam(param);
    expect(ids?.length).toBe(20);
  });

  it("trunca a 20 cuando se pasan más (con param corto)", () => {
    // 25 IDs de 1 char cada uno = ~49 chars (bien < 200)
    const param = Array.from({ length: 25 }, (_, i) => String(i + 1)).join(",");
    expect(param.length).toBeLessThan(200);
    const ids = validateLineIdsParam(param);
    expect(ids?.length).toBe(20);
    expect(ids?.[0]).toBe("1");
    expect(ids?.[19]).toBe("20");
  });

  it("filtra IDs vacíos (doble coma)", () => {
    const ids = validateLineIdsParam("121,,183,");
    expect(ids).toEqual(["121", "183"]);
  });

  it("devuelve undefined para null", () => {
    expect(validateLineIdsParam(null)).toBeUndefined();
  });

  it("rechaza lineIdsParam demasiado largo (> 200 chars)", () => {
    const long = Array.from({ length: 30 }, (_, i) => `line${i}`).join(","); // ~180 chars before joining
    const veryLong = "1".repeat(201);
    expect(validateLineIdsParam(veryLong)).toBeUndefined();
  });
});

// ── route/plan departAt ───────────────────────────────────────────────────────

describe("route/plan — departAt validation", () => {
  it("acepta ISO string futuro", () => {
    const future = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    expect(validateDepartAt(future)).toBeInstanceOf(Date);
  });

  it("acepta ISO string hace < 24h (planificación en el pasado reciente)", () => {
    const recent = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    expect(validateDepartAt(recent)).toBeInstanceOf(Date);
  });

  it("rechaza fecha 1970 (pasado lejano — usa día-de-semana incorrecto en los horarios)", () => {
    expect(validateDepartAt("1970-01-01T00:00:00Z")).toBeUndefined();
  });

  it("rechaza fecha hace más de 24h", () => {
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    expect(validateDepartAt(old)).toBeUndefined();
  });

  it("rechaza string no-fecha", () => {
    expect(validateDepartAt("mañana")).toBeUndefined();
    expect(validateDepartAt("")).toBeUndefined();
  });

  it("rechaza número", () => {
    expect(validateDepartAt(Date.now())).toBeUndefined();
  });

  it("rechaza null / undefined", () => {
    expect(validateDepartAt(null)).toBeUndefined();
    expect(validateDepartAt(undefined)).toBeUndefined();
  });
});
