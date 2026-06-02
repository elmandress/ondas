import { describe, it, expect } from "vitest";
import { detectLastBus, observedDelay } from "@/lib/delay-prediction";

describe("delay-prediction (F1.4) — honesto, sin inventar", () => {
  describe("detectLastBus", () => {
    it("marca último del día cuando la llegada coincide con la última corrida", () => {
      // now 22:50 (1370), última 23:00 (1380), llega 22:58 (1378) → es la última
      const r = detectLastBus(1378, 1380, 1370);
      expect(r.isLastOfDay).toBe(true);
      expect(r.lastHora).toBe(1380);
    });

    it("NO marca último si hay otra corrida después", () => {
      // now 22:00, última 23:00, esta llega 22:10 → NO es la última
      const r = detectLastBus(1330, 1380, 1320);
      expect(r.isLastOfDay).toBe(false);
    });

    it("NO avisa lejos del fin de servicio (mediodía)", () => {
      // now 12:00 (720), última 23:00 (1380) → fuera de ventana, no avisa
      const r = detectLastBus(1378, 1380, 720);
      expect(r.isLastOfDay).toBe(false);
    });

    it("sin dato de última corrida → no afirma nada", () => {
      const r = detectLastBus(1378, null, 1370);
      expect(r.isLastOfDay).toBe(false);
      expect(r.lastHora).toBeNull();
    });

    it("maneja corrida nocturna del día operativo (hora >1440) en la madrugada", () => {
      // now 0:20 AM (20 min), última corrida codificada 0:30 = 1470; el arrival llega
      // en 8 min → arrivalHora 28 → en escala nocturna 1468 ≈ 1470 → es la última.
      const r = detectLastBus(28, 1470, 20);
      expect(r.isLastOfDay).toBe(true);
    });
  });

  describe("observedDelay", () => {
    it("reporta atraso observado notable etiquetado 'en vivo'", () => {
      // now 10:00 (600), programado 10:05 (605), pero el bus en vivo llega en 12 min (10:12)
      const r = observedDelay(12, 605, 600);
      expect(r.delayMin).toBe(7);
      expect(r.label).toMatch(/7 min tarde \(en vivo\)/);
    });

    it("no muestra atrasos menores al umbral", () => {
      // llega 1 min tarde → no es notable
      const r = observedDelay(6, 605, 600);
      expect(r.label).toBeNull();
    });

    it("no inventa atraso sin horario programado de referencia", () => {
      const r = observedDelay(12, null, 600);
      expect(r.delayMin).toBeNull();
      expect(r.label).toBeNull();
    });

    it("un bus adelantado no se muestra como problema", () => {
      // programado 10:10, llega en 5 min (10:05) → adelantado, sin etiqueta
      const r = observedDelay(5, 610, 600);
      expect(r.label).toBeNull();
    });
  });
});
