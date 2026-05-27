/**
 * Búsqueda de esquinas (intersecciones de calles) usando Overpass API (OSM).
 *
 * En Uruguay las direcciones por esquinas son MUY comunes: "Amezaga y Justicia",
 * "Garibaldi esq Rivadavia". Esta lib detecta esos patrones y consulta Overpass
 * (mirror de Kumi por ser más rápido que el oficial):
 *   https://overpass.kumi.systems/api/interpreter
 *
 * Query Overpass:
 *   bbox Montevideo + Canelones cercano,
 *   ways highway con name~"calleA" → set .a
 *   ways highway con name~"calleB" → set .b
 *   nodes en intersección de ambos sets → resultado
 *
 * Devuelve coordenadas exactas del cruce + nombre normalizado.
 *
 * Server-only (hace fetch externo).
 */

const OVERPASS_URL = "https://overpass.kumi.systems/api/interpreter";
// bbox MVD metropolitano: lat_sur, lon_oeste, lat_norte, lon_este
const BBOX = "-34.95,-56.45,-34.7,-56.0";

/** Separadores típicos para intersecciones en Uruguay */
const SEPARATORS = /\s+(?:y|e|esquina|esq\.?|&|con)\s+/i;

export interface IntersectionResult {
  lat: number;
  lon: number;
  /** Nombre del cruce: "Amezaga y Justicia" */
  name: string;
  /** Dirección completa con barrio si está disponible */
  fullAddress: string;
}

/**
 * Detecta si el query parece una intersección y devuelve las dos calles.
 * Ejemplos:
 *   "Amezaga y Justicia" → ["Amezaga", "Justicia"]
 *   "Garibaldi esq Rivadavia" → ["Garibaldi", "Rivadavia"]
 *   "18 de julio" → null (sin separador real, "de" no cuenta)
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
  // Evitar parsear "18 de Julio" como esquina (separador "de" no está en
  // SEPARATORS, pero por las dudas filtramos cuando alguna parte es solo dígitos)
  if (/^\d{1,4}$/.test(a) || /^\d{1,4}$/.test(b)) return null;
  return [a, b];
}

/**
 * Saca tildes, prefijos comunes (av, dr, gral, etc) y palabras de relleno
 * para hacer el regex de Overpass tolerante a variantes.
 *
 * "Av. Dr. Juan B. Amézaga" → "amezaga"
 * "Avenida Italia" → "italia"
 * "Gral Flores" → "flores"
 */
function normalizeForOsm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // quitar diacríticos
    .replace(/\b(av|avda|avenida|bv|bvar|bulevar|gral|general|dr|doctor|cno|camino|calle|de la|de las|de los|del|de|esq|esquina)\b/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Convierte el nombre normalizado en un regex Overpass que matchea ignorando
 * tildes (matchea "Amezaga" tanto en "Amézaga" como en "Dr. Juan B. Amézaga").
 *
 * Para "amezaga" → "Am[eé]zaga|Am[eé]zaga"
 * Como Overpass aplica "i" para case-insensitive y los datos OSM tienen las
 * tildes, expandimos cada vocal a su forma con/sin tilde.
 */
function nameRegex(normalized: string): string {
  const main = normalized.split(/\s+/).filter((w) => w.length >= 3).pop() || normalized;
  return main
    .split("")
    .map((ch) => {
      if ("aeiou".includes(ch)) {
        const variants: Record<string, string> = {
          a: "[aá]", e: "[eé]", i: "[ií]", o: "[oó]", u: "[uúü]",
        };
        return variants[ch];
      }
      if (ch === "n") return "[nñ]";
      return ch;
    })
    .join("");
}

interface OverpassResp {
  elements: Array<{
    type: "node";
    id: number;
    lat: number;
    lon: number;
    tags?: Record<string, string>;
  }>;
}

/**
 * Busca el cruce de dos calles. Devuelve la esquina más cercana al centro de MVD
 * si hay múltiples (ej. dos calles con el mismo nombre que se cruzan dos veces).
 */
export async function findIntersection(
  streetA: string,
  streetB: string
): Promise<IntersectionResult | null> {
  const cleanA = normalizeForOsm(streetA);
  const cleanB = normalizeForOsm(streetB);
  if (!cleanA || !cleanB) return null;
  const regexA = nameRegex(cleanA);
  const regexB = nameRegex(cleanB);

  const query = `[out:json][timeout:10][bbox:${BBOX}];
way["highway"]["name"~"${regexA}",i]->.a;
way["highway"]["name"~"${regexB}",i]->.b;
node(w.a)(w.b);
out 10;`;

  try {
    const url = `${OVERPASS_URL}?data=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "OndasMVD/1.0 (transporte-montevideo@ondas.uy)" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as OverpassResp;
    const nodes = data.elements?.filter((e) => e.type === "node") || [];
    if (!nodes.length) return null;

    // Si hay varios cruces (ej. dos calles distintas con mismo nombre),
    // preferir el más cercano al centro de Montevideo (Plaza Independencia)
    // — heurística simple pero útil para casos ambiguos.
    const MVD_CENTER: [number, number] = [-34.9058, -56.1913];
    nodes.sort((a, b) => {
      const da = (a.lat - MVD_CENTER[0]) ** 2 + (a.lon - MVD_CENTER[1]) ** 2;
      const db = (b.lat - MVD_CENTER[0]) ** 2 + (b.lon - MVD_CENTER[1]) ** 2;
      return da - db;
    });
    const best = nodes[0];
    const displayName = `${capitalize(streetA)} y ${capitalize(streetB)}`;
    return {
      lat: best.lat,
      lon: best.lon,
      name: displayName,
      fullAddress: `${displayName}, Montevideo`,
    };
  } catch {
    return null;
  }
}

function capitalize(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase()).trim();
}

/** Helper combinado: dado un query libre, intenta resolver como esquina. */
export async function tryResolveIntersection(query: string): Promise<IntersectionResult | null> {
  const parsed = parseIntersection(query);
  if (!parsed) return null;
  return await findIntersection(parsed[0], parsed[1]);
}
