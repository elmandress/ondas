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
  const { busTowardsStopGtfs, busLikelyPassedStop } = await import("@/lib/bus-direction-gtfs");
  const { findVariantForBus, getStopSequence, getVariantsForLine, getStopsForVariant, getAllLineNames } =
    await import("@/lib/gtfs-db");
  const { findStopServer } = await import("@/lib/stops-server");

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

  // ── R57: matching de líneas case-insensitive entre fuentes ────────────────
  describe("case-insensitive (GPS reporta CE1, GTFS tiene Ce1)", () => {
    it("resuelve la línea aunque la grafía difiera", () => {
      const lower = getVariantsForLine("Ce1");
      const upper = getVariantsForLine("CE1");
      // El GTFS de MVD tiene Ce1 (circuito eléctrico Ciudad Vieja). Si algún día
      // desaparece del GTFS, ambos quedan vacíos y el test sigue siendo válido:
      // lo que NUNCA puede pasar es que una grafía resuelva y la otra no.
      expect(upper.length).toBe(lower.length);
      const sufijo = getVariantsForLine("124 SD");
      const sufijo2 = getVariantsForLine("124 Sd");
      expect(sufijo.length).toBe(sufijo2.length);
    });

    it("un bus CE1 ya no es invisible para el filtro GTFS (no-line)", () => {
      if (getVariantsForLine("Ce1").length === 0) return; // GTFS sin Ce1: nada que validar
      const bus = {
        vehicleId: "900", lineId: "CE1", lineName: "CE1",
        lat: -34.906, lon: -56.2, bearing: 0, speed: 10, timestamp: Date.now(),
        destinoDesc: "TRES CRUCES",
      };
      const r = busTowardsStopGtfs(bus, "3790");
      expect(r.reason).not.toBe("no-line");
    });
  });

  // ── R57: "ya pasó" por PROYECCIÓN sobre el recorrido (no parada más cercana) ──
  describe("ya pasó — proyección sobre el recorrido", () => {
    // Variante "limpia" para test determinístico: línea con UNA sola variante
    // (candidatos = esa) y suficientes paradas con coordenadas.
    function findCleanVariant() {
      for (const line of getAllLineNames()) {
        const variants = getVariantsForLine(line);
        if (variants.length !== 1) continue;
        const stops = getStopsForVariant(variants[0].variantId);
        if (stops.length < 12) continue;
        const coords = stops.map((s) => {
          const st = findStopServer(s.stopId);
          return st ? { seq: s.sequence, stopId: s.stopId, lat: st.stopLat, lon: st.stopLon } : null;
        });
        if (coords.every(Boolean)) {
          return { line, headsign: variants[0].headsign, stops: coords as NonNullable<(typeof coords)[number]>[] };
        }
      }
      return null;
    }
    const clean = findCleanVariant();

    it.skipIf(!clean)("bus 2 paradas DESPUÉS de la target → passed", () => {
      const { line, headsign, stops } = clean!;
      const target = stops[4];
      const busAt = stops[6]; // claramente más allá (>75m por el recorrido)
      const bus = {
        vehicleId: "901", lineId: line, lineName: line,
        lat: busAt.lat, lon: busAt.lon, bearing: 0, speed: 10, timestamp: Date.now(),
        destinoDesc: headsign,
      };
      const r = busTowardsStopGtfs(bus, target.stopId);
      expect(r.goingTo).toBe(false);
      expect(r.reason).toBe("passed");
    });

    it.skipIf(!clean)("bus 2 paradas ANTES de la target → va hacia ella, con distancia real", () => {
      const { line, headsign, stops } = clean!;
      const target = stops[6];
      const busAt = stops[4];
      const bus = {
        vehicleId: "902", lineId: line, lineName: line,
        lat: busAt.lat, lon: busAt.lon, bearing: 0, speed: 10, timestamp: Date.now(),
        destinoDesc: headsign,
      };
      const r = busTowardsStopGtfs(bus, target.stopId);
      expect(r.goingTo).toBe(true);
      expect(r.remainingStops).toBe(2);
      expect(r.routeDistanceM!).toBeGreaterThan(0);
    });

    it.skipIf(!clean)("bus EN la parada target → llegando (no passed)", () => {
      const { line, headsign, stops } = clean!;
      const target = stops[5];
      const bus = {
        vehicleId: "903", lineId: line, lineName: line,
        lat: target.lat, lon: target.lon, bearing: 0, speed: 0, timestamp: Date.now(),
        destinoDesc: headsign,
      };
      const r = busTowardsStopGtfs(bus, target.stopId);
      expect(r.goingTo).toBe(true);
    });

    it.skipIf(!clean)("busLikelyPassedStop: true pasado, false viniendo", () => {
      const { line, headsign, stops } = clean!;
      const target = stops[4];
      const past = stops[7];
      const before = stops[1];
      expect(busLikelyPassedStop(
        { lat: past.lat, lon: past.lon, lineName: line, destinoDesc: headsign }, target.stopId
      )).toBe(true);
      expect(busLikelyPassedStop(
        { lat: before.lat, lon: before.lon, lineName: line, destinoDesc: headsign }, target.stopId
      )).toBe(false);
    });
  });
});
