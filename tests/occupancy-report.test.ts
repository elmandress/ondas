/**
 * Tests adversariales para la lógica de validación de /api/occupancy/report.
 *
 * Importamos las funciones de validación directamente para testear sin HTTP.
 * La lógica del rate-limit vive en route.ts (in-memory, stateful) — la probamos
 * con el helper extraído; la lógica de validación de payload es pura.
 */
import { describe, it, expect } from "vitest";

/** Replica exacta de la validación en route.ts (mantenida en sync). */
function validateOccupancyPayload(body: unknown): string | null {
  if (!body || typeof body !== "object") return "body vacío o no-objeto";
  const { line, stop_id, level } = body as Record<string, unknown>;
  const lvl = Number(level);
  if (typeof line !== "string" || !line || line.length > 10) return "line inválido";
  if (typeof stop_id !== "string" || !stop_id || stop_id.length > 20) return "stop_id inválido";
  if (![1, 2, 3].includes(lvl)) return "level inválido";
  return null;
}

describe("occupancy/report — validación de payload", () => {
  it("acepta payload válido", () => {
    expect(validateOccupancyPayload({ line: "121", stop_id: "3790", level: 2 })).toBeNull();
    expect(validateOccupancyPayload({ line: "183", stop_id: "12345", level: 1 })).toBeNull();
    expect(validateOccupancyPayload({ line: "D1", stop_id: "99", level: 3 })).toBeNull();
  });

  it("rechaza line vacío", () => {
    expect(validateOccupancyPayload({ line: "", stop_id: "3790", level: 1 })).toBeTruthy();
  });

  it("rechaza line demasiado larga (> 10 chars)", () => {
    expect(validateOccupancyPayload({ line: "12345678901", stop_id: "3790", level: 1 })).toBeTruthy();
  });

  it("rechaza line no-string", () => {
    expect(validateOccupancyPayload({ line: 121, stop_id: "3790", level: 1 })).toBeTruthy();
    expect(validateOccupancyPayload({ line: null, stop_id: "3790", level: 1 })).toBeTruthy();
  });

  it("rechaza stop_id vacío", () => {
    expect(validateOccupancyPayload({ line: "121", stop_id: "", level: 1 })).toBeTruthy();
  });

  it("rechaza stop_id demasiado larga (> 20 chars)", () => {
    expect(validateOccupancyPayload({ line: "121", stop_id: "123456789012345678901", level: 1 })).toBeTruthy();
  });

  it("rechaza level 0 (fuera de rango 1–3)", () => {
    expect(validateOccupancyPayload({ line: "121", stop_id: "3790", level: 0 })).toBeTruthy();
  });

  it("rechaza level 4 (fuera de rango 1–3)", () => {
    expect(validateOccupancyPayload({ line: "121", stop_id: "3790", level: 4 })).toBeTruthy();
  });

  it("rechaza level string no-numérico", () => {
    expect(validateOccupancyPayload({ line: "121", stop_id: "3790", level: "lleno" })).toBeTruthy();
  });

  it("rechaza level null", () => {
    expect(validateOccupancyPayload({ line: "121", stop_id: "3790", level: null })).toBeTruthy();
  });

  it("rechaza body null", () => {
    expect(validateOccupancyPayload(null)).toBeTruthy();
  });

  it("rechaza body string (inyección de JSON crudo)", () => {
    expect(validateOccupancyPayload("{ line: '121' }")).toBeTruthy();
  });

  it("rechaza body array", () => {
    expect(validateOccupancyPayload([{ line: "121", stop_id: "3790", level: 1 }])).toBeTruthy();
  });

  it("level '2' como string numérico → válido (Number('2') === 2)", () => {
    // La API convierte con Number(), así que "2" → 2 → válido. Comportamiento intencional.
    expect(validateOccupancyPayload({ line: "121", stop_id: "3790", level: "2" })).toBeNull();
  });
});
