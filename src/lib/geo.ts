/**
 * Utilidades geográficas PURAS (sin dependencias, sin browser, sin dataset).
 * Seguro para importar desde cliente Y server. Fuente única de la distancia haversine
 * — antes había 6 copias repartidas (distM, haversineM, haversine, haversineKm,
 * haversineMeters, distanceTo) → duplicación. Esta es la canónica.
 */

const EARTH_R_M = 6371000;

/** Distancia haversine en METROS entre dos coords (lat/lon en grados). */
export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return EARTH_R_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Distancia haversine en KILÓMETROS. */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  return haversineMeters(lat1, lon1, lat2, lon2) / 1000;
}
