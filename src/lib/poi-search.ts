/**
 * Búsqueda local de POIs montevideanos (SRS FR-3.2 prioridad 1).
 *
 * Combina:
 *  - Lista curada con aliases (data/mvd-pois.json) generada desde Overpass + hand-curated
 *  - Scoring por prefix match en nombre/aliases
 *  - Boost por categoría (shopping/terminal/hospital > museum/park)
 *
 * Esta búsqueda SIEMPRE corre primero. Si devuelve >=3 matches buenos,
 * el endpoint /api/geocode no llama a Nominatim. Sino, los completa.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require("path") as typeof import("path");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require("fs") as typeof import("fs");

export type PoiCategory =
  | "shopping" | "hospital" | "university" | "terminal" | "airport"
  | "stadium" | "theatre" | "museum" | "park" | "cinema" | "place";

export interface CuratedPoi {
  id: string;
  name: string;
  aliases: string[];
  category: PoiCategory;
  lat: number;
  lon: number;
  address?: string;
}

export interface ScoredPoi extends CuratedPoi {
  score: number;
}

let _pois: CuratedPoi[] | null = null;

function loadPois(): CuratedPoi[] {
  if (_pois) return _pois;
  try {
    const POIS_PATH = path.join(process.cwd(), "data", "mvd-pois.json");
    if (!fs.existsSync(POIS_PATH)) {
      console.warn("[poi-search] mvd-pois.json not found");
      return [];
    }
    _pois = JSON.parse(fs.readFileSync(POIS_PATH, "utf-8"));
    return _pois!;
  } catch (err) {
    console.error("[poi-search] error loading pois:", err);
    return [];
  }
}

// Quita marcas diacríticas combinables (Unicode U+0300 a U+036F)
const DIACRITICS_RE = /[̀-ͯ]/g;

function stripAccents(s: string): string {
  return s.normalize("NFKD").replace(DIACRITICS_RE, "");
}

function normalize(s: string): string {
  return stripAccents(s.toLowerCase()).trim();
}

const CATEGORY_BOOST: Record<PoiCategory, number> = {
  shopping: 30,
  terminal: 28,
  airport: 28,
  hospital: 25,
  university: 22,
  stadium: 20,
  theatre: 15,
  museum: 12,
  cinema: 10,
  park: 8,
  place: 5,
};

// Palabras vacías (stopwords) que no deben generar score por sí solas
// — evita que "de", "y", "la" matcheen contra cualquier POI que las contenga.
const STOPWORDS = new Set([
  "de", "del", "la", "el", "los", "las", "y", "e", "o", "u", "a", "al",
  "en", "con", "por", "para", "un", "una",
]);

function isContentToken(t: string): boolean {
  return t.length >= 2 && !STOPWORDS.has(t);
}

// Patrones que NO son nombres de lugar — son direcciones, números, calles.
// Para estos, devolvemos pocos resultados curados (solo matches exactos/prefix fuerte).
const ADDRESS_HINT_RE = /\b\d{2,4}\b|\b(calle|avenida|av|bulevar|bvar|rambla|paso|camino|ruta|km)\b/i;

export function searchPois(query: string, limit = 5): ScoredPoi[] {
  const q = normalize(query);
  if (q.length < 1) return [];

  const pois = loadPois();
  const tokensAll = q.split(/\s+/).filter(Boolean);
  const tokens = tokensAll.filter(isContentToken);
  // Si después de sacar stopwords no queda nada de contenido, usar los originales
  const effectiveTokens = tokens.length > 0 ? tokens : tokensAll;

  // Si el query parece una dirección, sólo aceptamos matches muy fuertes (exact/prefix completo).
  // Esto evita que "18 de julio" devuelva "Devoto" porque matchea "de" como token-prefix.
  const looksLikeAddress = ADDRESS_HINT_RE.test(query);

  const results: ScoredPoi[] = [];

  for (const poi of pois) {
    const nameNorm = normalize(poi.name);
    const allTexts = [nameNorm, ...poi.aliases];

    let bestScore = 0;
    for (const text of allTexts) {
      // exact match: máximo
      if (text === q) { bestScore = Math.max(bestScore, 100); continue; }
      // prefix match del query completo: alto
      if (text.startsWith(q)) { bestScore = Math.max(bestScore, 80); continue; }
      // substring match del query completo: medio
      if (text.includes(q) && q.length >= 3) { bestScore = Math.max(bestScore, 60); continue; }

      if (looksLikeAddress) continue; // para direcciones no aplicamos matches por token suelto

      // todos los tokens de contenido como palabra: alto-medio
      const allTokensMatch = effectiveTokens.length > 1 &&
        effectiveTokens.every((t) => text.includes(t));
      if (allTokensMatch) { bestScore = Math.max(bestScore, 55); continue; }

      // algún token de contenido matchea prefix de palabra en el texto: bajo
      // (uso \b word boundary aproximado para evitar match dentro de palabras grandes)
      const someTokenPrefix = effectiveTokens.some((t) => {
        if (t.length < 3) return false;
        return text === t || text.startsWith(t + " ") || text.includes(" " + t);
      });
      if (someTokenPrefix) { bestScore = Math.max(bestScore, 25); continue; }
    }

    if (bestScore > 0) {
      const boost = CATEGORY_BOOST[poi.category] ?? 0;
      results.push({ ...poi, score: bestScore + boost });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

export function getIconForCategory(cat: PoiCategory): string {
  switch (cat) {
    case "shopping": return "🛍️";
    case "hospital": return "🏥";
    case "university": return "🎓";
    case "terminal": return "🚌";
    case "airport": return "✈️";
    case "stadium": return "🏟️";
    case "theatre": return "🎭";
    case "museum": return "🏛️";
    case "park": return "🌳";
    case "cinema": return "🎬";
    case "place": return "📍";
  }
}
