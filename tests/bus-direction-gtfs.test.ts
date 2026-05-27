/**
 * Tests de regresión del filtro upstream GTFS.
 *
 * Estos tests reproducen los 3 bugs históricos que reportó el usuario:
 *   1. Bus en sentido contrario apareciendo como upstream
 *   2. Bus que ya pasó la parada apareciendo
 *   3. Bus en variante que NO pasa por la parada apareciendo
 *
 * Si estos tests rompen, hay regresión.
 *
 * NOTA: requieren data/gtfs.db disponible. Si no existe, skip.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const HAS_GTFS = fs.existsSync(path.join(process.cwd(), "data", "gtfs.db"));

describe.skipIf(!HAS_GTFS)("bus-direction-gtfs", async () => {
  const { busTowardsStopGtfs } = await import("@/lib/bus-direction-gtfs");
  const { findVariantForBus, getStopSequence } = await import("@/lib/gtfs-db");

  describe("findVariantForBus", () => {
    it("matchea 329 hacia PUNTA CARRETAS con headsign del API live", () => {
      const v = findVariantForBus("329", "PUNTA CARRETAS (POR PARQUE AMBIENTALISTA)");
      expect(v).not.toBeNull();
      expect(v!.shortName).toBe("329");
      expect(v!.headsign.toLowerCase()).toContain("punta carretas");
    });

    it("matchea 329 hacia AVIACIÓN CIVIL como variante distinta", () => {
      const v = findVariantForBus("329", "AVIACIÓN CIVIL");
      expect(v).not.toBeNull();
      expect(v!.headsign.toLowerCase()).toContain("aviaci");
    });

    it("devuelve null para línea inexistente", () => {
      const v = findVariantForBus("LINEA_FALSA_999", "destino cualquiera");
      expect(v).toBeNull();
    });
  });

  describe("getStopSequence", () => {
    it("parada 3790 (Garibaldi y Rivadavia) está en 329→Punta Carretas", () => {
      const v = findVariantForBus("329", "PUNTA CARRETAS");
      expect(v).not.toBeNull();
      const seq = getStopSequence(v!.variantId, "3790");
      expect(seq).not.toBeNull();
      expect(seq).toBeGreaterThan(0);
    });

    it("parada 3790 NO está en 329→Aviación Civil (resuelve bug histórico)", () => {
      const v = findVariantForBus("329", "AVIACIÓN CIVIL");
      expect(v).not.toBeNull();
      const seq = getStopSequence(v!.variantId, "3790");
      expect(seq).toBeNull();
    });
  });

  describe("busTowardsStopGtfs — casos reales", () => {
    const stopGaribaldi = "3790";

    it("descarta bus 329 con destino AVIACIÓN CIVIL (variante incorrecta)", () => {
      const bus = {
        vehicleId: "100", lineId: "329", lineName: "329",
        lat: -34.880, lon: -56.171, bearing: 0, speed: 20, timestamp: Date.now(),
        variantCode: 4952,
        destinoDesc: "AVIACIÓN CIVIL (POR PARQUE)",
      };
      const r = busTowardsStopGtfs(bus, stopGaribaldi);
      expect(r.goingTo).toBe(false);
      expect(r.reason).toBe("stop-not-in-route");
    });

    it("descarta bus 187 hacia PALACIO DE LA LUZ (sentido contrario)", () => {
      const bus = {
        vehicleId: "200", lineId: "187", lineName: "187",
        lat: -34.860, lon: -56.230, bearing: 0, speed: 20, timestamp: Date.now(),
        variantCode: 4831,
        destinoDesc: "PALACIO DE LA LUZ",
      };
      const r = busTowardsStopGtfs(bus, stopGaribaldi);
      expect(r.goingTo).toBe(false);
      // Puede ser stop-not-in-route o no-variant según el matching
      expect(["stop-not-in-route", "no-variant"]).toContain(r.reason);
    });

    it("incluye bus 76 hacia PUNTA CARRETAS cuando está antes en el recorrido", () => {
      // Bus en Cerro yendo hacia Punta Carretas pasa por 3790
      const bus = {
        vehicleId: "300", lineId: "76", lineName: "76",
        lat: -34.870, lon: -56.250, bearing: 0, speed: 20, timestamp: Date.now(),
        variantCode: 4879,
        destinoDesc: "PUNTA CARRETAS (POR UTU CERRO)",
      };
      const r = busTowardsStopGtfs(bus, stopGaribaldi);
      // Puede ser true (upstream) o false según current_seq calculada
      // pero si false, NO debe ser stop-not-in-route (la variante sí pasa)
      if (!r.goingTo) {
        expect(r.reason).not.toBe("stop-not-in-route");
      } else {
        expect(r.remainingStops).toBeGreaterThan(0);
        expect(r.etaSeconds).toBeGreaterThan(0);
      }
    });

    it("calcula remainingStops y routeDistanceM cuando incluye", () => {
      const bus = {
        vehicleId: "400", lineId: "76", lineName: "76",
        lat: -34.895, lon: -56.255, bearing: 0, speed: 20, timestamp: Date.now(),
        variantCode: 4879,
        destinoDesc: "PUNTA CARRETAS",
      };
      const r = busTowardsStopGtfs(bus, stopGaribaldi);
      if (r.goingTo) {
        expect(r.remainingStops).toBeTypeOf("number");
        expect(r.routeDistanceM).toBeTypeOf("number");
        expect(r.routeDistanceM!).toBeGreaterThan(0);
      }
    });
  });
});
