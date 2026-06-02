"use client";

/**
 * Llegadas para una parada del INTERIOR (stopId "int-zona-code"). La API STM no las
 * cubre; las armamos del GPS en vivo (avl): buscamos los buses de la zona cuya PRÓXIMA
 * parada (nextStopCode = p1c) es esta, y estimamos el ETA por distancia/velocidad.
 * Honesto: posición real (en vivo); el ETA es estimado.
 */
import { useEffect, useState } from "react";
import type { Arrival } from "@/lib/stm";

interface InteriorBusDto {
  lat: number; lon: number; bus: string; line: string; lineName: string;
  speed: number; nextStop?: string; nextStopCode?: string; delayMin?: number; occupancy?: number;
}

function haversineM(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371000, dLat = ((bLat - aLat) * Math.PI) / 180, dLon = ((bLon - aLon) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/** Parse "int-<zona>-<code>" → { zona, code }. */
function parseInteriorId(stopId: string): { zona: string; code: string } | null {
  const m = stopId.match(/^int-([a-z]+)-(.+)$/);
  return m ? { zona: m[1], code: m[2] } : null;
}

/** ~radio (m) para considerar un bus de la línea "circulando cerca" de la parada. */
const NEARBY_M = 4000;

export function useInteriorArrivals(
  stopId: string | null, stopLat?: number, stopLon?: number, stopLines?: string[],
) {
  const [arrivals, setArrivals] = useState<Arrival[]>([]);
  const [loading, setLoading] = useState(false);
  const linesKey = (stopLines || []).join(",");

  useEffect(() => {
    const info = stopId ? parseInteriorId(stopId) : null;
    if (!info) { setArrivals([]); return; }
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    const lineSet = new Set((stopLines || []).map((l) => l.trim()));

    const fetchit = async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/gps/interior?zona=${info.zona}`);
        const d = await r.json();
        if (cancelled) return;
        const buses = (d.buses || []) as InteriorBusDto[];
        const etaOf = (b: InteriorBusDto) => {
          const dist = stopLat != null && stopLon != null ? haversineM(b.lat, b.lon, stopLat, stopLon) : null;
          const speedMs = (b.speed > 3 ? b.speed : 16) * 1000 / 3600;
          return { dist, etaMin: dist != null ? Math.max(0, Math.round(dist / speedMs / 60)) : 0 };
        };
        const toArrival = (b: InteriorBusDto, etaMin: number, approaching: boolean): Arrival => ({
          lineId: b.line, lineName: b.line,
          destination: b.lineName || b.line, destinationCode: 0,
          eta: etaMin, etaSeconds: etaMin * 60,
          realtime: true, vehicleId: `${info.zona}-${b.bus}`,
          lat: b.lat, lon: b.lon,
          // si NO es la próxima parada exacta, lo marcamos como "en la zona" (estimado).
          isScheduled: !approaching,
        });

        // 1. PRIORITARIO: buses cuya próxima parada es ESTA (ETA confiable).
        const approaching = buses.filter((b) => b.nextStopCode === info.code);
        const approachingIds = new Set(approaching.map((b) => b.bus));
        const list: Arrival[] = approaching.map((b) => toArrival(b, etaOf(b).etaMin, true));

        // 2. COMPLEMENTO: para no decir "sin buses" cuando hay servicio en la zona.
        //    - Si conocemos las LÍNEAS de la parada → buses de esas líneas a ≤4km.
        //    - Si NO (parada nueva sin líneas aún) → cualquier bus MUY cerca (≤1km),
        //      que claramente está pasando por ahí.
        if (stopLat != null && stopLon != null) {
          const knowLines = lineSet.size > 0;
          for (const b of buses) {
            if (approachingIds.has(b.bus)) continue;
            const { dist, etaMin } = etaOf(b);
            if (dist == null) continue;
            const ok = knowLines
              ? (lineSet.has(b.line.trim()) && dist <= NEARBY_M)
              : dist <= 1000;
            if (ok) list.push(toArrival(b, etaMin, false));
          }
        }
        // dedupe por bus (un bus podría entrar por approaching y complemento)
        const seen = new Set<string>();
        const dedup = list.filter((a) => { const k = a.vehicleId!; if (seen.has(k)) return false; seen.add(k); return true; });
        dedup.sort((a, b) => a.eta - b.eta);
        setArrivals(dedup.slice(0, 20));
      } catch { /* fuente caída */ }
      finally { if (!cancelled) setLoading(false); }
    };

    fetchit();
    timer = setInterval(fetchit, 15000);
    return () => { cancelled = true; if (timer) clearInterval(timer); };
  }, [stopId, stopLat, stopLon, linesKey]);

  return { arrivals, loading };
}

export function isInteriorStop(stopId: string | null): boolean {
  return !!stopId && stopId.startsWith("int-");
}
