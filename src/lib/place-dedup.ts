/**
 * Dedup de lugares para el geocoder (/api/geocode).
 *
 * El dedup por proximidad (<50 m) no alcanza: el POI curado de "Shopping Tres Cruces"
 * usa las coords de la terminal y el de Nominatim el centroide OSM del edificio —
 * quedan a >50 m y el usuario ve el MISMO lugar dos veces ("Shopping Tres Cruces" y
 * "Tres Cruces Shopping"). Acá: mismo nombre (tokens normalizados y ordenados,
 * ignorando el área tras la coma) + <300 m ⇒ mismo lugar.
 *
 * 300 m es conservador a propósito: sucursales de una cadena (Devoto, Tienda Inglesa)
 * suelen estar a más de eso, y además sus nombres de Nominatim incluyen el barrio
 * ("Devoto, Centro") que rompe la igualdad de tokens.
 */

function nameTokens(name: string): string {
  return name
    .split(",")[0] // ignorar área/barrio agregado ("Tres Cruces Shopping, Cordón")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");
}

/** Distancia plana en metros (suficiente para comparar lugares urbanos). */
function distM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dx = (lon2 - lon1) * 111320 * Math.cos((lat1 * Math.PI) / 180);
  const dy = (lat2 - lat1) * 111320;
  return Math.hypot(dx, dy);
}

export interface PlaceLike {
  name: string;
  lat: number;
  lon: number;
}

const SAME_NAME_MAX_M = 300;
const SAME_POINT_MAX_M = 55;

/** ¿`a` y `b` son el mismo lugar? Mismo punto (<55 m) o mismo nombre a <300 m. */
export function isSamePlace(a: PlaceLike, b: PlaceLike): boolean {
  const d = distM(a.lat, a.lon, b.lat, b.lon);
  if (d < SAME_POINT_MAX_M) return true;
  if (d < SAME_NAME_MAX_M && nameTokens(a.name) === nameTokens(b.name)) return true;
  return false;
}

/** Filtra de `candidates` los que duplican algo de `kept` (o entre sí). */
export function dedupePlaces<T extends PlaceLike>(kept: PlaceLike[], candidates: T[]): T[] {
  const out: T[] = [];
  for (const c of candidates) {
    if (kept.some((k) => isSamePlace(k, c))) continue;
    if (out.some((o) => isSamePlace(o, c))) continue;
    out.push(c);
  }
  return out;
}
