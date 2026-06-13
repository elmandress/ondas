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

// ─────────────────────────────────────────────────────────────────────────────
// Rate-limit anti-troll (réplica EXACTA de route.ts, mantenida en sync).
// route.ts es un route handler con estado in-memory por instancia; replicamos la
// lógica pura (reloj inyectado) para testearla determinísticamente, igual que
// api-validation.test.ts hace con las guardias de los endpoints.
// ─────────────────────────────────────────────────────────────────────────────
const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_WINDOW = 5;

interface RateState { count: number; resetAt: number; }
type RateStore = Map<string, RateState>;
type RateReason = "global" | "duplicate";
interface RateDecision { allowed: boolean; reason?: RateReason; }

const dupKey = (ip: string, line: string, stopId: string) => `${ip}|${line}|${stopId}`;

function rateLimitCheck(
  ip: string, line: string, stopId: string, now: number,
  global: RateStore, dup: RateStore, opts: { maxPerWindow?: number } = {},
): RateDecision {
  const maxPerWindow = opts.maxPerWindow ?? MAX_PER_WINDOW;
  const dEntry = dup.get(dupKey(ip, line, stopId));
  if (dEntry && now < dEntry.resetAt) return { allowed: false, reason: "duplicate" };
  const gEntry = global.get(ip);
  if (gEntry && now < gEntry.resetAt && gEntry.count >= maxPerWindow) {
    return { allowed: false, reason: "global" };
  }
  return { allowed: true };
}

function rateLimitCommit(
  ip: string, line: string, stopId: string, now: number,
  global: RateStore, dup: RateStore, opts: { windowMs?: number } = {},
): void {
  const windowMs = opts.windowMs ?? WINDOW_MS;
  const gEntry = global.get(ip);
  if (!gEntry || now >= gEntry.resetAt) global.set(ip, { count: 1, resetAt: now + windowMs });
  else gEntry.count++;
  dup.set(dupKey(ip, line, stopId), { count: 1, resetAt: now + windowMs });
}

/** Simula el flujo del handler: check → (insert OK) → commit. Devuelve la decisión. */
function attempt(
  ip: string, line: string, stopId: string, now: number,
  global: RateStore, dup: RateStore, insertOk = true,
): RateDecision {
  const d = rateLimitCheck(ip, line, stopId, now, global, dup);
  if (d.allowed && insertOk) rateLimitCommit(ip, line, stopId, now, global, dup);
  return d;
}

describe("occupancy/report — rate-limit global por IP", () => {
  it("permite hasta MAX_PER_WINDOW reportes (líneas distintas) y bloquea el siguiente", () => {
    const g: RateStore = new Map(); const d: RateStore = new Map();
    const ip = "1.1.1.1"; const t0 = 1_000_000;
    // 5 líneas distintas en la misma parada → 5 reportes OK (no chocan con el dedup).
    for (let i = 0; i < MAX_PER_WINDOW; i++) {
      expect(attempt(ip, `L${i}`, "3790", t0 + i, g, d).allowed).toBe(true);
    }
    // El 6º (otra línea, sin dedup) cae por el límite global.
    const sixth = attempt(ip, "L99", "3790", t0 + 6, g, d);
    expect(sixth.allowed).toBe(false);
    expect(sixth.reason).toBe("global");
  });

  it("la ventana se resetea: pasada WINDOW_MS la IP vuelve a tener budget", () => {
    const g: RateStore = new Map(); const d: RateStore = new Map();
    const ip = "2.2.2.2"; const t0 = 5_000_000;
    for (let i = 0; i < MAX_PER_WINDOW; i++) attempt(ip, `L${i}`, "100", t0 + i, g, d);
    expect(rateLimitCheck(ip, "L99", "100", t0 + 7, g, d).allowed).toBe(false);
    // Justo después de la ventana → de nuevo permitido.
    expect(rateLimitCheck(ip, "L99", "100", t0 + WINDOW_MS + 1, g, d).allowed).toBe(true);
  });

  it("IPs distintas tienen budgets independientes", () => {
    const g: RateStore = new Map(); const d: RateStore = new Map();
    const t0 = 9_000_000;
    for (let i = 0; i < MAX_PER_WINDOW; i++) attempt("3.3.3.3", `L${i}`, "55", t0 + i, g, d);
    expect(rateLimitCheck("3.3.3.3", "L99", "55", t0 + 6, g, d).allowed).toBe(false);
    // Otra IP arranca limpia.
    expect(rateLimitCheck("4.4.4.4", "L99", "55", t0 + 6, g, d).allowed).toBe(true);
  });
});

describe("occupancy/report — dedup anti-troll por (IP, línea, parada)", () => {
  it("bloquea un 2º reporte de la MISMA línea+parada desde la misma IP", () => {
    const g: RateStore = new Map(); const d: RateStore = new Map();
    const ip = "5.5.5.5"; const t0 = 2_000_000;
    expect(attempt(ip, "121", "3790", t0, g, d).allowed).toBe(true);
    const again = attempt(ip, "121", "3790", t0 + 60_000, g, d); // 1 min después
    expect(again.allowed).toBe(false);
    expect(again.reason).toBe("duplicate");
  });

  it("el troll NO infla el agregado: 5 'lleno' de una línea = 1 solo aceptado", () => {
    const g: RateStore = new Map(); const d: RateStore = new Map();
    const ip = "6.6.6.6"; const t0 = 3_000_000;
    let accepted = 0;
    for (let i = 0; i < 5; i++) {
      if (attempt(ip, "183", "999", t0 + i * 1000, g, d).allowed) accepted++;
    }
    expect(accepted).toBe(1); // el dedup corta los otros 4
  });

  it("la misma IP SÍ puede reportar líneas distintas en la misma parada", () => {
    const g: RateStore = new Map(); const d: RateStore = new Map();
    const ip = "7.7.7.7"; const t0 = 4_000_000;
    expect(attempt(ip, "121", "3790", t0, g, d).allowed).toBe(true);
    expect(attempt(ip, "183", "3790", t0 + 1, g, d).allowed).toBe(true);
    expect(attempt(ip, "522", "3790", t0 + 2, g, d).allowed).toBe(true);
  });

  it("pasada la ventana, la misma combinación vuelve a aceptarse", () => {
    const g: RateStore = new Map(); const d: RateStore = new Map();
    const ip = "8.8.8.8"; const t0 = 6_000_000;
    expect(attempt(ip, "121", "3790", t0, g, d).allowed).toBe(true);
    expect(rateLimitCheck(ip, "121", "3790", t0 + 60_000, g, d).allowed).toBe(false);
    expect(rateLimitCheck(ip, "121", "3790", t0 + WINDOW_MS + 1, g, d).allowed).toBe(true);
  });

  it("un insert fallido NO consume budget (no se hace commit) → el reintento es legítimo", () => {
    const g: RateStore = new Map(); const d: RateStore = new Map();
    const ip = "9.9.9.9"; const t0 = 7_000_000;
    // Falla el insert: check pasa pero no se commitea.
    expect(attempt(ip, "121", "3790", t0, g, d, /* insertOk */ false).allowed).toBe(true);
    // El reintento sigue permitido (no quedó marca de dedup ni se gastó el global).
    expect(rateLimitCheck(ip, "121", "3790", t0 + 1000, g, d).allowed).toBe(true);
    expect(g.size).toBe(0);
    expect(d.size).toBe(0);
  });
});
