/**
 * safety-zones.ts — Recomendación de seguridad NOCTURNA por zona.
 *
 * Postura (clave, leer): NO etiquetamos barrios como "peligrosos", ni mostramos su
 * nombre con un juicio, ni estigmatizamos a nadie. Usamos datos OFICIALES de
 * criminalidad solo para que, DE NOCHE, podamos sugerir no caminar un tramo en
 * zonas de periferia con más delito violento y ofrecer taxi/Uber como alternativa.
 * El objetivo es la seguridad del usuario — no un juicio sobre comunidades.
 *
 * En la UI nunca decimos el nombre de la zona ni "peligrosa": solo algo como
 * "zona poco transitada / con poca iluminación de noche". El detalle de la fuente
 * y la postura se explica en Ajustes.
 *
 * Fuentes (delito violento — rapiñas/homicidios por barrio, May 2026):
 *  - Observatorio Nacional sobre Violencia y Criminalidad, Min. del Interior.
 *  - El Observador, "Barrio a barrio: zonas más peligrosas de Montevideo".
 *  - Telenoche, "Barrios más inseguros de Montevideo".
 *
 * Centroides aproximados (Nominatim/OSM) + radio. Son APROXIMADOS: el objetivo es
 * un disparador conservador, no una frontera exacta. Ante la duda, el peor caso es
 * sugerir un taxi de noche (algo benigno).
 */

export interface NightZone {
  /** Solo para referencia interna / debugging — NO se muestra en la UI. */
  name: string;
  lat: number;
  lon: number;
  radiusKm: number;
}

// Periferia con mayor delito VIOLENTO (lo relevante para "no caminar de noche").
// Los hurtos en zonas comerciales (Centro, Pocitos…) son otra cosa y no se marcan acá.
const NIGHT_ZONES: NightZone[] = [
  { name: "Casavalle", lat: -34.8289, lon: -56.1688, radiusKm: 1.7 },
  { name: "Cerro Norte", lat: -34.8703, lon: -56.2565, radiusKm: 1.6 },
  { name: "La Paloma–Tomkinson", lat: -34.8588, lon: -56.2594, radiusKm: 1.6 },
  { name: "Malvín Norte", lat: -34.8779, lon: -56.1193, radiusKm: 1.3 },
  { name: "Manga", lat: -34.8097, lon: -56.1469, radiusKm: 1.7 },
  { name: "Peñarol", lat: -34.8292, lon: -56.1982, radiusKm: 1.4 },
  { name: "Cruz de Carrasco", lat: -34.8640, lon: -56.0780, radiusKm: 1.3 },
  { name: "Bañados de Carrasco", lat: -34.8407, lon: -56.0790, radiusKm: 1.6 },
  { name: "Colón Centro/Sur", lat: -34.8060, lon: -56.2215, radiusKm: 1.4 },
];

// Distancia: utilidad geográfica única (lib/geo).
import { haversineKm } from "@/lib/geo";

/**
 * ¿El punto cae en una zona marcada para precaución nocturna?
 * Devuelve true/false (no exponemos el nombre hacia la UI por diseño).
 */
export function isCautionNightZone(lat: number, lon: number): boolean {
  return NIGHT_ZONES.some((z) => haversineKm(lat, lon, z.lat, z.lon) <= z.radiusKm);
}

export type WalkAdvisoryLevel = "none" | "soft" | "recommend";

// Umbral mínimo para siquiera ofrecer taxi: por menos de esto, caminás y listo
// (no tiene sentido un taxi por 150 m — feedback del usuario).
const MIN_WALK_M = 500;

/**
 * Decide cuánto recomendar reemplazar una caminata por taxi/Uber.
 *  - "recommend": de noche, caminata ≥500 m que termina en una zona de precaución.
 *  - "soft": de noche con caminata larga, o de día con caminata muy larga → opción discreta.
 *  - "none": no hace falta ofrecer nada (tramo corto, de día, sin marca).
 *
 * `endLat/endLon` = destino de la caminata (donde el usuario quedaría a pie).
 */
export function walkAdvisory(
  walkMeters: number,
  endLat: number,
  endLon: number,
  atNight: boolean
): WalkAdvisoryLevel {
  if (walkMeters < MIN_WALK_M) return "none";
  const flagged = isCautionNightZone(endLat, endLon);
  if (atNight && flagged) return "recommend";
  if (atNight && walkMeters >= 600) return "soft";
  if (!atNight && walkMeters >= 1000) return "soft";
  return "none";
}
