import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { STOPS_DATASET, getStopsSync, type BusStop } from "@/lib/stm";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatEta(minutes: number): string {
  if (minutes <= 0) return "Ahora";
  if (minutes === 1) return "1 min";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function etaClass(minutes: number): string {
  if (minutes <= 2) return "chip-arrive";
  if (minutes <= 8) return "chip-soon";
  return "chip-far";
}

export function etaColorClass(minutes: number): string {
  if (minutes <= 2) return "text-emerald-400";
  if (minutes <= 8) return "text-amber-400";
  return "text-slate-400";
}

/**
 * Buffer dinámico para incertidumbre del bus.
 * Bus rara vez pasa exacto a la hora: agregamos colchón creciente según distancia.
 *  - <5 min de caminata → +1 min de buffer
 *  - 5–10 min → +2 min
 *  - >10 min → +3 min
 */
export function dynamicBuffer(walkMinutes: number): number {
  if (walkMinutes < 5) return 1;
  if (walkMinutes <= 10) return 2;
  return 3;
}

/**
 * Tiempo recomendado para salir: ETA del bus - caminata - buffer.
 * Si ya no llegás, devuelve 0 (significa "salí ahora o no llegás").
 */
export function walkToLeaveTime(walkMinutes: number, etaMinutes: number): number {
  const buffer = dynamicBuffer(walkMinutes);
  return Math.max(0, etaMinutes - walkMinutes - buffer);
}

export function leaveNowUrgency(leaveInMinutes: number): "now" | "soon" | "chill" {
  if (leaveInMinutes <= 1) return "now";
  if (leaveInMinutes <= 5) return "soon";
  return "chill";
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" });
}

/** Paradas cercanas — funciona en cliente con el cache de stops (lazy-loaded). */
export function getNearbyStopsClient(lat: number, lon: number, radiusM = 600, limit = 6): BusStop[] {
  const stops = getStopsSync();
  if (stops.length === 0) return [];
  return stops
    .filter((s) => haversineMeters(lat, lon, s.stopLat, s.stopLon) <= radiusM)
    .sort((a, b) => haversineMeters(lat, lon, a.stopLat, a.stopLon) - haversineMeters(lat, lon, b.stopLat, b.stopLon))
    .slice(0, limit);
}

/** Paradas dentro de un bounding box (viewport del mapa). */
export function getStopsInBoundsClient(
  minLat: number, maxLat: number, minLon: number, maxLon: number, limit = 250
): BusStop[] {
  const stops = getStopsSync();
  if (stops.length === 0) return [];
  const result: BusStop[] = [];
  for (const s of stops) {
    if (s.stopLat >= minLat && s.stopLat <= maxLat && s.stopLon >= minLon && s.stopLon <= maxLon) {
      result.push(s);
      if (result.length >= limit) break;
    }
  }
  return result;
}

export function distanceTo(lat1: number, lon1: number, lat2: number, lon2: number): number {
  return Math.round(haversineMeters(lat1, lon1, lat2, lon2));
}

export function walkingMinutes(distanceMeters: number): number {
  return Math.ceil(distanceMeters / 75); // 75 m/min ≈ 4.5 km/h
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Mantener export de STOPS_DATASET para retrocompatibilidad (proxy)
export { STOPS_DATASET };
