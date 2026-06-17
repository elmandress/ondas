"use client";

/**
 * Llegadas para una parada del INTERIOR (stopId "int-zona-code"). La API STM no las cubre;
 * las armamos del GPS en vivo (Busmatick). Antes esto usaba un proxy débil: "buses cuya
 * próxima parada (p1c) es ESTA" + distancia en línea recta — ignoraba el grafo de secuencia
 * inferido y el sentido. Ahora pasa por `bus-direction-interior` (espejo de
 * `bus-direction-gtfs`): navega el grafo p1c→target y clasifica en 3 capas honestas.
 *
 *   - approaching → llegada con "a N paradas · ~M min" (grafo encierra la cadena)
 *   - nearby      → llegada con "~M min" sin conteo (línea sirve + cerca, grafo no conecta)
 *   - in-zone     → fuera de llegadas: "circulando en la zona" (presencia, sin ETA)
 *
 * Todo ETA del interior es ESTIMADO (el grafo da orden, no tiempo) → `etaApprox: true`
 * siempre → la UI lo muestra con "~", nunca con la confianza del ETA geométrico de MVD.
 */
import { useEffect, useState } from "react";
import type { Arrival } from "@/lib/stm";
import {
  classifyInteriorBus,
  type InteriorEdges,
  type InteriorClassifyInput,
} from "@/lib/bus-direction-interior";

interface InteriorBusDto extends InteriorClassifyInput {
  bus: string;
  lineName: string;
  occupancy?: number;
}

/** Línea de bus de la zona que está circulando pero NO podemos confirmar que viene acá. */
export interface InZoneLine {
  line: string;
  /** Distancia en línea recta a la parada (m) del bus más cercano de esa línea. */
  distM: number;
}

/** Parse "int-<zona>-<code>" → { zona, code }. */
function parseInteriorId(stopId: string): { zona: string; code: string } | null {
  const m = stopId.match(/^int-([a-z]+)-(.+)$/);
  return m ? { zona: m[1], code: m[2] } : null;
}

// El grafo de secuencia (interior-edges.json, 2.8KB) se sirve desde public/ y se fetchea
// una sola vez por sesión — el recorrido no cambia entre refrescos.
let _edges: InteriorEdges | null = null;
let _edgesPromise: Promise<InteriorEdges> | null = null;
function loadEdges(): Promise<InteriorEdges> {
  if (_edges) return Promise.resolve(_edges);
  if (!_edgesPromise) {
    _edgesPromise = fetch("/interior-edges.json")
      .then((r) => (r.ok ? r.json() : {}))
      .then((j: InteriorEdges) => (_edges = j || {}))
      .catch(() => (_edges = {}));
  }
  return _edgesPromise;
}

export function useInteriorArrivals(
  stopId: string | null,
  stopLat?: number,
  stopLon?: number,
  stopLines?: string[],
) {
  const [arrivals, setArrivals] = useState<Arrival[]>([]);
  const [inZone, setInZone] = useState<InZoneLine[]>([]);
  const [loading, setLoading] = useState(false);
  const linesKey = (stopLines || []).join(",");

  useEffect(() => {
    const info = stopId ? parseInteriorId(stopId) : null;
    if (!info || stopLat == null || stopLon == null) {
      setArrivals([]);
      setInZone([]);
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    const target = {
      zona: info.zona,
      code: info.code,
      lat: stopLat,
      lon: stopLon,
      lines: (stopLines || []).map((l) => l.trim()).filter(Boolean),
    };

    const toArrival = (b: InteriorBusDto, etaMin: number, hops: number | undefined): Arrival => ({
      lineId: b.line,
      lineName: b.line,
      destination: b.lineName || b.line,
      destinationCode: 0,
      eta: etaMin,
      etaSeconds: etaMin * 60,
      realtime: true,
      vehicleId: `${info.zona}-${b.bus}`,
      lat: b.lat,
      lon: b.lon,
      // El grafo da orden, no tiempo → el ETA es estimado. La UI lo muestra con "~".
      etaApprox: true,
      // approaching conoce el conteo de paradas; nearby no afirma ninguno.
      remainingStops: hops,
    });

    const fetchit = async () => {
      setLoading(true);
      try {
        const [edges, res] = await Promise.all([
          loadEdges(),
          fetch(`/api/gps/interior?zona=${info.zona}`).then((r) => r.json()),
        ]);
        if (cancelled) return;
        const buses = (res.buses || []) as InteriorBusDto[];

        const list: Arrival[] = [];
        // Mejor (menor distancia) bus por línea que quedó "en la zona".
        const zoneByLine = new Map<string, number>();
        const seen = new Set<string>();

        for (const b of buses) {
          const c = classifyInteriorBus(b, target, edges);
          if (!c) continue;
          if (c.tier === "in-zone") {
            const prev = zoneByLine.get(b.line);
            if (prev == null || c.distM < prev) zoneByLine.set(b.line, c.distM);
            continue;
          }
          // approaching | nearby → llegada (dedupe por coche).
          const key = `${info.zona}-${b.bus}`;
          if (seen.has(key)) continue;
          seen.add(key);
          list.push(toArrival(b, c.etaMin ?? 0, c.tier === "approaching" ? c.hops : undefined));
        }

        list.sort((a, b) => a.eta - b.eta);
        // No mostramos como "en la zona" una línea que ya tiene una llegada arriba.
        const arrivingLines = new Set(list.map((a) => a.lineName));
        const zone: InZoneLine[] = [...zoneByLine.entries()]
          .filter(([line]) => !arrivingLines.has(line))
          .map(([line, distM]) => ({ line, distM }))
          .sort((a, b) => a.distM - b.distM);

        setArrivals(list.slice(0, 20));
        setInZone(zone.slice(0, 8));
      } catch {
        /* fuente caída */
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchit();
    timer = setInterval(fetchit, 15000);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [stopId, stopLat, stopLon, linesKey]);

  return { arrivals, inZone, loading };
}

export function isInteriorStop(stopId: string | null): boolean {
  return !!stopId && stopId.startsWith("int-");
}
