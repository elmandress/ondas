import { describe, it, expect } from "vitest";
import { classifyArea } from "@/lib/route-area";

// Puntos de referencia reales
const PLAZA_INDEPENDENCIA = { lat: -34.9066, lon: -56.1996 };
const POCITOS = { lat: -34.9119, lon: -56.1525 };
const LAS_PIEDRAS = { lat: -34.726, lon: -56.219 };       // dentro del bbox metropolitano
const SANTA_LUCIA = { lat: -34.4528, lon: -56.3905 };     // fuera del bbox, <80km
const PUNTA_DEL_ESTE = { lat: -34.9608, lon: -54.9433 };  // fuera, ~110km → interdept
const SALTO = { lat: -31.3833, lon: -57.9667 };           // fuera, ~400km → interdept

describe("classifyArea (FR-4.6)", () => {
  it("origen y destino dentro de cobertura → ok", () => {
    expect(classifyArea(PLAZA_INDEPENDENCIA, POCITOS)).toEqual({ kind: "ok" });
    expect(classifyArea(PLAZA_INDEPENDENCIA, LAS_PIEDRAS)).toEqual({ kind: "ok" });
  });

  it("sin puntos (o solo puntos en cobertura) → ok", () => {
    expect(classifyArea(null, null)).toEqual({ kind: "ok" });
    expect(classifyArea(PLAZA_INDEPENDENCIA, null)).toEqual({ kind: "ok" });
  });

  it("solo destino lejano (origen aún vacío) → ya clasifica interdept (la UI muestra EmptyState antes)", () => {
    expect(classifyArea(null, PUNTA_DEL_ESTE)).toEqual({ kind: "interdepartmental", which: "to" });
  });

  it("destino fuera del bbox pero cerca (<80km) → out-of-coverage", () => {
    expect(classifyArea(PLAZA_INDEPENDENCIA, SANTA_LUCIA)).toEqual({ kind: "out-of-coverage", which: "to" });
  });

  it("origen fuera del bbox pero cerca → out-of-coverage which=from", () => {
    expect(classifyArea(SANTA_LUCIA, PLAZA_INDEPENDENCIA)).toEqual({ kind: "out-of-coverage", which: "from" });
  });

  it("destino a más de 80km → interdepartamental", () => {
    expect(classifyArea(PLAZA_INDEPENDENCIA, PUNTA_DEL_ESTE)).toEqual({ kind: "interdepartmental", which: "to" });
    expect(classifyArea(PLAZA_INDEPENDENCIA, SALTO)).toEqual({ kind: "interdepartmental", which: "to" });
  });

  it("origen a más de 80km → interdepartamental which=from", () => {
    expect(classifyArea(SALTO, PLAZA_INDEPENDENCIA)).toEqual({ kind: "interdepartmental", which: "from" });
  });

  it("ambos a más de 80km → interdepartamental which=both", () => {
    expect(classifyArea(SALTO, PUNTA_DEL_ESTE)).toEqual({ kind: "interdepartmental", which: "both" });
  });

  it("ambos fuera pero cerca → out-of-coverage which=both", () => {
    const sl2 = { lat: -34.44, lon: -56.45 };
    expect(classifyArea(SANTA_LUCIA, sl2)).toEqual({ kind: "out-of-coverage", which: "both" });
  });
});
