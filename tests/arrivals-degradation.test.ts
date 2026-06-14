// @vitest-environment node
import { describe, it, expect, vi } from "vitest";

/**
 * Regresión R67: el endpoint /api/stm/arrivals mezcla llegadas EN VIVO y PROGRAMADAS
 * en UNA sola respuesta. `getStopVariants` es un fetch LIVE al STM que corre PRIMERO y
 * SERIAL; si tarda/cae, el riesgo es que la función entera muera (timeout de Netlify)
 * SIN servir los horarios programados — que NO dependen del STM. Este test fija el
 * contrato de degradación: si getStopVariants TIRA (simula timeout), la ruta debe
 * caer al fallback de horarios programados y devolver 200, nunca 5xx ni vacío.
 *
 * (Ver ARQUITECTURA.md §11 — anti-patrón "fate compartido vivo+programado".)
 */

// getStopVariants tira como si el STM hubiera timeouteado. El resto de @/lib/stm real.
vi.mock("@/lib/stm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/stm")>();
  return {
    ...actual,
    getStopVariants: vi.fn(async () => {
      throw new Error("simulated STM timeout (getStopVariants)");
    }),
  };
});

// El dataset de horarios programados sí tiene datos para esta parada (fallback vivo).
vi.mock("@/lib/schedule-db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/schedule-db")>();
  return {
    ...actual,
    getScheduledArrivalsForStop: vi.fn(() => [
      { lineCode: "183", minutesFromNow: 12, hora: 42, horaStr: "00:42" },
      { lineCode: "21", minutesFromNow: 25, hora: 55, horaStr: "00:55" },
    ]),
  };
});

import { GET } from "@/app/api/stm/arrivals/route";
import { NextRequest } from "next/server";

describe("arrivals · degradación (R67) — un fallo del live NO mata los programados", () => {
  it("getStopVariants que tira (timeout) → 200 con horarios programados, nunca 5xx", async () => {
    const req = new NextRequest("http://localhost/api/stm/arrivals?stopId=3178");
    const res = await GET(req);

    expect(res.status).toBe(200); // jamás 500/504 aunque el live caiga
    const body = await res.json();
    expect(Array.isArray(body.arrivals)).toBe(true);
    expect(body.arrivals.length).toBeGreaterThan(0); // sirvió los programados
    expect(body.source).toBe("schedule-only");
    expect(body.degraded).toBe(true);
    // Nunca cachear un fallback degradado (mismo criterio que el fix de cache).
    expect(res.headers.get("Cache-Control")).toContain("no-store");
  });

  it("stopId inválido → 400, sin tocar el STM", async () => {
    const req = new NextRequest("http://localhost/api/stm/arrivals");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });
});
