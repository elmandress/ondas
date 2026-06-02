"use client";

/**
 * Buses del INTERIOR en vivo (GPS Busmatick vía /api/gps/interior). La API de
 * Montevideo no cubre el interior; estas son fuentes por departamento (Maldonado,
 * Paysandú, Rivera…). Detectamos la zona por las coords del centro del mapa y
 * polleamos solo si estás mirando esa zona (no gastamos red en Montevideo).
 */
import { useEffect, useState } from "react";
import type { VehiclePosition } from "@/lib/stm";

interface InteriorBusDto {
  lat: number; lon: number; bus: string; line: string; lineName: string;
  speed: number; heading: number; hora: string;
  nextStop?: string; delayMin?: number; occupancy?: number;
}

// Bounding boxes de cada zona con fuente GPS de interior (verificadas funcionando).
// San Carlos cae dentro del bbox de Maldonado depto; lo ponemos antes para que su fuente
// (más específica de la ciudad de San Carlos) gane cuando mirás esa zona.
const ZONES: { zona: string; minLat: number; maxLat: number; minLon: number; maxLon: number }[] = [
  { zona: "sancarlos", minLat: -34.82, maxLat: -34.74, minLon: -54.95, maxLon: -54.85 },
  { zona: "maldonado", minLat: -35.10, maxLat: -34.70, minLon: -55.30, maxLon: -54.60 },
  { zona: "paysandu", minLat: -32.50, maxLat: -31.90, minLon: -58.30, maxLon: -57.60 },
  { zona: "rocha", minLat: -34.55, maxLat: -34.35, minLon: -54.45, maxLon: -54.25 },
];

export function zoneForPoint(lat: number, lon: number): string | null {
  for (const z of ZONES) {
    if (lat >= z.minLat && lat <= z.maxLat && lon >= z.minLon && lon <= z.maxLon) return z.zona;
  }
  return null;
}

export function useInteriorBuses(centerLat?: number, centerLon?: number, enabled = true): VehiclePosition[] {
  const [buses, setBuses] = useState<VehiclePosition[]>([]);
  const zona = centerLat != null && centerLon != null ? zoneForPoint(centerLat, centerLon) : null;

  useEffect(() => {
    if (!enabled || !zona) { setBuses([]); return; }
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const fetchBuses = async () => {
      try {
        const r = await fetch(`/api/gps/interior?zona=${zona}`);
        if (!r.ok) return;
        const d = await r.json();
        if (cancelled) return;
        const list: VehiclePosition[] = (d.buses as InteriorBusDto[]).map((b) => ({
          vehicleId: `${zona}-${b.bus}`,
          lineId: b.line,
          lineName: b.line,
          lat: b.lat, lon: b.lon,
          bearing: b.heading,
          speed: b.speed,
          timestamp: Date.now(),
          destinoDesc: b.lineName,
          nextStop: b.nextStop,
          delayMin: b.delayMin,
          occupancy: b.occupancy,
        }));
        setBuses(list);
      } catch { /* fuente caída: dejamos lo último */ }
    };

    fetchBuses();
    timer = setInterval(fetchBuses, 15000);
    const onVis = () => { if (!document.hidden) fetchBuses(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { cancelled = true; if (timer) clearInterval(timer); document.removeEventListener("visibilitychange", onVis); };
  }, [zona, enabled]);

  return buses;
}
