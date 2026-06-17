import { describe, it, expect } from "vitest";
import {
  hopsToStop,
  etaMinFromHops,
  classifyInteriorBus,
  AVG_SECONDS_PER_HOP,
  MAX_HOPS,
  type InteriorEdges,
  type InteriorTarget,
} from "@/lib/bus-direction-interior";

// Parada real de Maldonado (interior-stops.json) — base de los casos por proximidad.
const STOP: InteriorTarget = {
  zona: "maldonado",
  code: "109",
  lat: -34.91682,
  lon: -54.95805,
  lines: ["7", "15"],
};
// ~111m por 0.001° de latitud → offsets fáciles de razonar.
const near = (m: number) => STOP.lat + m / 111320; // desplaza al norte m metros

describe("hopsToStop — navegación del grafo dirigido", () => {
  const linear = { "A>B": 1, "B>C": 1, "C>D": 1 };

  it("cuenta saltos en una cadena lineal", () => {
    expect(hopsToStop(linear, "A", "D")).toBe(3);
    expect(hopsToStop(linear, "B", "D")).toBe(2);
  });

  it("from === target → 0 saltos (llegando)", () => {
    expect(hopsToStop(linear, "C", "C")).toBe(0);
  });

  it("es dirigido: hacia atrás no se alcanza", () => {
    expect(hopsToStop(linear, "D", "A")).toBeNull();
  });

  it("target ausente o fragmento desconectado → null", () => {
    expect(hopsToStop(linear, "A", "Z")).toBeNull();
    expect(hopsToStop({ "A>B": 1, "X>Y": 1 }, "A", "Y")).toBeNull();
  });

  it("no se cuelga con ciclos de terminal", () => {
    const cycle = { "A>B": 1, "B>C": 1, "C>A": 1 };
    expect(hopsToStop(cycle, "A", "C")).toBe(2);
    expect(hopsToStop(cycle, "A", "Z")).toBeNull(); // recorre el ciclo y termina
  });

  it("respeta el tope de profundidad", () => {
    const chain = { "S0>S1": 1, "S1>S2": 1, "S2>S3": 1, "S3>S4": 1 };
    expect(hopsToStop(chain, "S0", "S4", 2)).toBeNull();
    expect(hopsToStop(chain, "S0", "S4", 10)).toBe(4);
  });
});

describe("etaMinFromHops — estimado por constante sin validar", () => {
  it("convierte saltos a minutos con AVG_SECONDS_PER_HOP", () => {
    expect(etaMinFromHops(0)).toBe(0);
    expect(etaMinFromHops(1)).toBe(Math.round(AVG_SECONDS_PER_HOP / 60)); // 90s → 2 min
    expect(etaMinFromHops(4)).toBe(Math.round((4 * AVG_SECONDS_PER_HOP) / 60)); // 6 min
  });
});

describe("classifyInteriorBus — 3 capas de honestidad", () => {
  const edges: InteriorEdges = {
    "maldonado|7|1": { "108>109": 1, "109>110": 1 },
  };

  it("approaching: el grafo encierra p1c→target dentro de los topes", () => {
    const r = classifyInteriorBus(
      { line: "7", dir: "1", nextStopCode: "108", lat: near(150), lon: STOP.lon },
      STOP,
      edges,
    );
    expect(r?.tier).toBe("approaching");
    expect(r?.hops).toBe(1);
    expect(r?.etaMin).toBe(2);
    expect(r?.estimated).toBe(true); // todo ETA del interior es estimado
  });

  it("approaching con p1c === target → 0 saltos (llegando)", () => {
    const r = classifyInteriorBus(
      { line: "7", dir: "1", nextStopCode: "109", lat: near(80), lon: STOP.lon },
      STOP,
      edges,
    );
    expect(r?.tier).toBe("approaching");
    expect(r?.hops).toBe(0);
  });

  it("más allá de MAX_HOPS: NO afirma conteo, degrada a nearby si está cerca", () => {
    // cadena de 10 saltos p1c→target (> MAX_HOPS), bus cerca (<1.5km).
    const longSub: Record<string, number> = {};
    for (let i = 0; i < 10; i++) longSub[`N${i}>N${i + 1}`] = 1;
    longSub["N10>109"] = 1; // 11 saltos hasta el target
    const r = classifyInteriorBus(
      { line: "7", dir: "1", nextStopCode: "N0", lat: near(300), lon: STOP.lon },
      { ...STOP, zona: "maldonado" },
      { "maldonado|7|1": longSub },
    );
    expect(11).toBeGreaterThan(MAX_HOPS);
    expect(r?.tier).toBe("nearby");
    expect(r?.hops).toBeUndefined();
    expect(r?.etaMin).toBeGreaterThanOrEqual(0);
  });

  it("nearby: línea sirve + cerca, pero el grafo no conecta", () => {
    const r = classifyInteriorBus(
      // dir/p1c que no están en el subgrafo → sin approaching; bus a ~556m.
      { line: "7", dir: "1", nextStopCode: "999", lat: near(556), lon: STOP.lon },
      STOP,
      edges,
    );
    expect(r?.tier).toBe("nearby");
    expect(r?.hops).toBeUndefined();
    expect(r?.etaMin).toBeGreaterThan(0);
  });

  it("in-zone: línea sirve pero lejos (1.5–4km) → presencia, sin ETA", () => {
    const r = classifyInteriorBus(
      { line: "7", lat: near(2800), lon: STOP.lon }, // ~2.8km, sin grafo
      STOP,
      edges,
    );
    expect(r?.tier).toBe("in-zone");
    expect(r?.etaMin).toBeUndefined();
    expect(r?.distM).toBeGreaterThan(1500);
  });

  it("null: otra línea o fuera de la zona no aporta nada", () => {
    expect(
      classifyInteriorBus({ line: "99", lat: near(500), lon: STOP.lon }, STOP, edges),
    ).toBeNull();
    expect(
      classifyInteriorBus({ line: "7", lat: near(6000), lon: STOP.lon }, STOP, edges),
    ).toBeNull();
  });

  it("parada sin líneas conocidas: solo un bus MUY cerca cuenta como pasando", () => {
    const noLines = { ...STOP, lines: [] };
    expect(
      classifyInteriorBus({ line: "7", lat: near(500), lon: STOP.lon }, noLines, edges)?.tier,
    ).toBe("nearby");
    expect(
      classifyInteriorBus({ line: "7", lat: near(1500), lon: STOP.lon }, noLines, edges),
    ).toBeNull();
  });
});
