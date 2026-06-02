/**
 * rideshare.ts — Combinar el bus con taxi/Uber para un tramo (idea de Guille:
 * de noche o cuando convenga por seguridad).
 *
 * Honestidad (importante): NO mostramos un precio inventado. Uber/Cabify usan
 * precio DINÁMICO (varía con la demanda) y el taxi va con taxímetro — cualquier
 * número que pongamos sería engañoso. Por eso solo abrimos la app con el viaje
 * precargado y el precio real lo muestra la app. Como referencia interna sabemos
 * que Uber MVD tiene tarifa mínima ~$80 y sube por km + minuto + surge, pero el
 * total real depende del momento.
 *
 * Uber deep links: https://developer.uber.com/docs/deep-linking
 */

export interface LatLon {
  lat: number;
  lon: number;
}

/**
 * Universal link de Uber con el viaje precargado. Abre la app nativa si está
 * instalada; si no, cae a la web de Uber.
 */
export function uberDeepLink(pickup: LatLon, dropoff: LatLon, dropoffName?: string): string {
  const p = new URLSearchParams();
  p.set("action", "setPickup");
  p.set("pickup[latitude]", pickup.lat.toFixed(6));
  p.set("pickup[longitude]", pickup.lon.toFixed(6));
  p.set("dropoff[latitude]", dropoff.lat.toFixed(6));
  p.set("dropoff[longitude]", dropoff.lon.toFixed(6));
  if (dropoffName) p.set("dropoff[formatted_address]", dropoffName);
  return `https://m.uber.com/ul/?${p.toString()}`;
}

/**
 * Link a Google Maps en modo "cómo llegar" en auto, como respaldo neutral para
 * abrir cualquier app de viajes / ver el trayecto (no fuerza Uber).
 */
export function mapsRideLink(dropoff: LatLon): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${dropoff.lat},${dropoff.lon}&travelmode=driving`;
}

/** ¿Estamos en franja de tarifa NOCTURNA de taxi (22:00–06:00, hora de Montevideo)? */
export function isNightTariff(date: Date = new Date()): boolean {
  const hourStr = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Montevideo",
    hour: "2-digit",
    hour12: false,
  }).format(date);
  let hour = parseInt(hourStr, 10);
  if (hour === 24) hour = 0;
  return hour >= 22 || hour < 6;
}
