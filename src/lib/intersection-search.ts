/**
 * Búsqueda de esquinas (intersecciones de calles) usando la API IDE Uruguay.
 *
 * En Uruguay las direcciones por esquinas son muy comunes: "Amezaga y Justicia",
 * "Garibaldi esq Rivadavia". Esta lib detecta esos patrones y consulta:
 *   https://direcciones.ide.uy/api/v1/geocode/cruces
 *
 * Devuelve coordenadas exactas del cruce + nombre normalizado.
 *
 * Server-only (hace fetch externo).
 */

const IDE_BASE = "https://direcciones.ide.uy/api/v1/geocode";

/** Separadores típicos para intersecciones en Uruguay */
const SEPARATORS = /\s+(?:y|e|esquina|esq\.?|&|con)\s+/i;

export interface IntersectionResult {
  lat: number;
  lon: number;
  /** Nombre completo del cruce: "AMEZAGA ESQ JUSTICIA" */
  name: string;
  /** Localidad/departamento */
  fullAddress: string;
}

/**
 * Detecta si el query parece una intersección y devuelve las dos calles.
 * Ejemplos:
 *   "Amezaga y Justicia" → ["Amezaga", "Justicia"]
 *   "Garibaldi esq Rivadavia" → ["Garibaldi", "Rivadavia"]
 *   "18 de julio" → null (sin separador)
 *   "av italia y propios" → ["av italia", "propios"]
 */
export function parseIntersection(query: string): [string, string] | null {
  const q = query.trim();
  if (!q || q.length < 5) return null;
  const m = q.split(SEPARATORS);
  if (m.length !== 2) return null;
  const a = m[0].trim();
  const b = m[1].trim();
  if (a.length < 2 || b.length < 2) return null;
  // Evitar parsear "18 de Julio" como esquina (de=preposición, no separador)
  // El separador "de" no está en SEPARATORS pero por las dudas filtramos números
  if (/^\d{1,4}$/.test(a) || /^\d{1,4}$/.test(b)) return null;
  return [a, b];
}

/** Quitar prefijos comunes (av, avenida, dr, doctor, etc) para matching más permisivo */
function cleanStreetName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\b(av|avenida|bv|bulevar|gral|general|dr|doctor|cno|camino|calle|de la|de las|de los|del|de)\b/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Busca el cruce de dos calles en Montevideo. Devuelve la esquina más probable.
 * Si no encuentra, devuelve null.
 */
export async function findIntersection(streetA: string, streetB: string): Promise<IntersectionResult | null> {
  const url = `${IDE_BASE}/cruces?calle=${encodeURIComponent(streetA)}&departamento=Montevideo&localidad=Montevideo&limit=200`;
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{
      address: string; lat: number; lng: number;
    }>;
    if (!Array.isArray(data) || data.length === 0) return null;

    // Buscar el address que contenga la calle B (matching tolerante)
    const targetB = cleanStreetName(streetB);
    if (!targetB) return null;

    const matches = data.filter((r) => {
      const addr = cleanStreetName(r.address || "");
      return addr.includes(targetB);
    });

    if (matches.length === 0) return null;

    // Si hay varios, elegir el "mejor" — el que tenga el nombre B más corto/completo
    // (prioriza match exacto sobre substring)
    matches.sort((a, b) => {
      const aClean = cleanStreetName(a.address);
      const bClean = cleanStreetName(b.address);
      const aExact = aClean.split(" ").includes(targetB) ? 0 : 1;
      const bExact = bClean.split(" ").includes(targetB) ? 0 : 1;
      return aExact - bExact;
    });

    const best = matches[0];
    return {
      lat: best.lat,
      lon: best.lng,
      name: best.address.split(",")[0].trim(),
      fullAddress: best.address,
    };
  } catch {
    return null;
  }
}

/** Helper combinado: dado un query libre, intenta resolver como esquina. */
export async function tryResolveIntersection(query: string): Promise<IntersectionResult | null> {
  const parsed = parseIntersection(query);
  if (!parsed) return null;
  // Probar A → B
  const ab = await findIntersection(parsed[0], parsed[1]);
  if (ab) return ab;
  // Probar B → A (a veces la API tiene una calle como principal y otra como secundaria)
  return await findIntersection(parsed[1], parsed[0]);
}
