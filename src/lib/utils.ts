import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { STOPS_DATASET, getStopsSync, type BusStop } from "@/lib/stm";
import { haversineMeters } from "@/lib/geo";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatEta(minutes: number, approx = false): string {
  if (minutes <= 0) return approx ? "~Ya" : "Ahora";
  // "~" cuando el ETA es estimado por distancia (no por recorrido GTFS) → honestidad:
  // no prometemos el minuto exacto cuando no podemos ubicar el bus en su recorrido.
  const tilde = approx ? "~" : "";
  if (minutes === 1) return `${tilde}1 min`;
  if (minutes < 60) return `${tilde}${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${tilde}${h}h` : `${tilde}${h}h ${m}m`;
}

export function etaClass(minutes: number): string {
  if (minutes <= 2) return "chip-arrive";
  if (minutes <= 8) return "chip-soon";
  return "chip-far";
}

export function etaColorClass(minutes: number): string {
  // Calmado a propósito: solo lo inminente se resalta; el resto neutro y legible
  // (antes todo <=8min salía ámbar → sensación de urgencia constante).
  if (minutes <= 2) return "text-emerald-400";
  return "text-slate-200";
}

/**
 * Buffer dinámico para incertidumbre del bus.
 * El bus rara vez pasa exacto a la hora — y a veces se ADELANTA. Mejor llegar a la
 * parada unos minutos antes y esperar, que correr y que se te pase en la cara.
 * Una persona tampoco sale en el instante exacto: necesita terminar lo que hace,
 * agarrar las cosas y arrancar. Por eso el colchón mínimo es de 4 min y sube con la
 * caminata: preferimos avisar de más que dejar al usuario corriendo o perdiendo el bus.
 *  - <5 min de caminata  → +4 min de buffer
 *  - 5–10 min            → +5 min
 *  - >10 min             → +6 min
 */
export function dynamicBuffer(walkMinutes: number): number {
  if (walkMinutes < 5) return 4;
  if (walkMinutes <= 10) return 5;
  return 6;
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
  // Factor de sinuosidad 1.3: la distancia REAL caminando por las calles es ~30% mayor
  // que la línea recta (no podés cruzar manzanas en diagonal). Sin esto subestimábamos
  // el tiempo a pie → el aviso "salí ahora" llegaba tarde (queja del usuario).
  // 75 m/min ≈ 4.5 km/h. Mínimo 2 min: nunca decir "0 a pie", siempre toma algo llegar.
  const realMeters = distanceMeters * 1.3;
  return Math.max(2, Math.ceil(realMeters / 75));
}

// Mantener export de STOPS_DATASET para retrocompatibilidad (proxy)
export { STOPS_DATASET };
