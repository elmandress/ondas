import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  classifyInteriorBus,
  type InteriorEdges,
  type InteriorClassifyInput,
  type InteriorTarget,
} from "@/lib/bus-direction-interior";

/**
 * Snapshot real del feed Busmatick de Maldonado, capturado con
 * `scripts/capture-busmatick-snapshot.mjs`. Espejo de cómo las paradas 2201/4615 fijaron
 * los buses-fantasma de MVD: un dato vivo congelado que pin-ea (a) los nombres de campo
 * del feed (sen/p1c/p2c) y (b) la integración del motor con el grafo real, sin red en CI.
 *
 * Si el feed cambia de forma, recapturar y, si hace falta, actualizar el par dirigido
 * conocido de abajo (es específico de ESTE snapshot, como las paradas de MVD).
 */
const ROOT = process.cwd();

function latestFixture(): string {
  const dir = path.join(ROOT, "tests", "fixtures");
  const files = fs.readdirSync(dir).filter((f) => /^busmatick-maldonado-\d+\.xml$/.test(f)).sort();
  return path.join(dir, files[files.length - 1]);
}

const tag = (block: string, t: string): string => {
  const m = block.match(new RegExp(`<${t}>([^<]*)</${t}>`, "i"));
  return m ? m[1].trim() : "";
};

// Parse mínimo con los MISMOS campos que el endpoint (route.ts) — pin del contrato.
function parseFixture(xml: string): (InteriorClassifyInput & { bus: string })[] {
  const out: (InteriorClassifyInput & { bus: string })[] = [];
  for (const m of xml.match(/<marker>[\s\S]*?<\/marker>/gi) || []) {
    const lat = parseFloat(tag(m, "lat"));
    const lon = parseFloat(tag(m, "lon"));
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    out.push({
      bus: tag(m, "bus"),
      line: tag(m, "lin"),
      dir: tag(m, "sen") || undefined,
      nextStopCode: tag(m, "p1c") || undefined,
      nextNextStopCode: tag(m, "p2c") || undefined,
      lat,
      lon,
      speed: parseFloat(tag(m, "vel")) || undefined,
    });
  }
  return out;
}

const xml = fs.readFileSync(latestFixture(), "latin1");
const buses = parseFixture(xml);
const edges = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "interior-edges.json"), "utf-8")) as InteriorEdges;
const stops = JSON.parse(fs.readFileSync(path.join(ROOT, "public", "interior-stops.json"), "utf-8")) as Record<
  string,
  { zona: string; code: string; lat: number; lon: number; lines: string[] }
>;

function stopTarget(code: string): InteriorTarget {
  const s = stops[`maldonado|${code}`];
  return { zona: "maldonado", code, lat: s.lat, lon: s.lon, lines: s.lines };
}

describe("snapshot Busmatick Maldonado — contrato del feed", () => {
  it("el feed trae markers parseables", () => {
    expect(buses.length).toBeGreaterThan(0);
  });

  it("pin de campos: al menos un bus reporta sen + p1c + p2c", () => {
    const withDir = buses.filter((b) => b.dir && b.nextStopCode && b.nextNextStopCode);
    expect(withDir.length).toBeGreaterThan(0);
  });
});

describe("snapshot Busmatick — integración con el motor", () => {
  it("clasifica todos los buses sin romper y con campos coherentes por capa", () => {
    const target = stopTarget("109");
    for (const b of buses) {
      const r = classifyInteriorBus(b, target, edges);
      if (!r) continue;
      expect(["approaching", "nearby", "in-zone"]).toContain(r.tier);
      expect(r.estimated).toBe(true);
      if (r.tier === "approaching") {
        expect(typeof r.hops).toBe("number");
        expect(typeof r.etaMin).toBe("number");
      }
      if (r.tier === "in-zone") {
        expect(r.etaMin).toBeUndefined(); // demovido: presencia, sin ETA
      }
      expect(r.distM).toBeGreaterThanOrEqual(0);
    }
  });

  // Par dirigido REAL de este snapshot: bus línea 7, sen 1, p1c 108 → parada real 109
  // (108>109 es arista del grafo maldonado|7|1). Valida la cadena completa con dato vivo.
  it("caso approaching real: el bus de la línea 7 en p1c 108 llega a la parada 109", () => {
    const bus = buses.find((b) => b.line === "7" && b.dir === "1" && b.nextStopCode === "108");
    if (!bus) return; // snapshot recapturado sin este bus → lo cubren los tests puros
    const r = classifyInteriorBus(bus, stopTarget("109"), edges);
    expect(r?.tier).toBe("approaching");
    expect(r?.hops).toBe(1);
    expect(r?.etaMin).toBe(1); // ~1 min (1 salto × 50s, calibrado 2026-06-17)
  });
});
