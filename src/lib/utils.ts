import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { STOPS_DATASET, type BusStop } from "@/lib/stm";

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
  if (minutes <= 2) return "text-green-400";
  if (minutes <= 8) return "text-orange-400";
  return "text-slate-400";
}

export function walkToLeaveTime(walkMinutes: number, etaMinutes: number): number {
  return Math.max(0, etaMinutes - walkMinutes);
}

export function leaveNowUrgency(leaveInMinutes: number): "now" | "soon" | "chill" {
  if (leaveInMinutes <= 1) return "now";
  if (leaveInMinutes <= 5) return "soon";
  return "chill";
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" });
}

// Búsqueda de paradas cercanas del lado del cliente
export function getNearbyStopsClient(lat: number, lon: number, radiusM = 600): BusStop[] {
  return STOPS_DATASET.filter((s) => {
    const dist = haversineMeters(lat, lon, s.stopLat, s.stopLon);
    return dist <= radiusM;
  })
    .sort((a, b) => haversineMeters(lat, lon, a.stopLat, a.stopLon) - haversineMeters(lat, lon, b.stopLat, b.stopLon))
    .slice(0, 6);
}

// Distancia entre dos paradas en metros
export function distanceTo(lat1: number, lon1: number, lat2: number, lon2: number): number {
  return Math.round(haversineMeters(lat1, lon1, lat2, lon2));
}

// Tiempo caminando estimado (4.5 km/h)
export function walkingMinutes(distanceMeters: number): number {
  return Math.ceil(distanceMeters / 75); // 75m/min ≈ 4.5km/h
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
