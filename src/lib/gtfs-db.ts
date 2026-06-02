/**
 * Acceso al GTFS pre-procesado (data/gtfs-v2.json).
 *
 * Permite responder con CERTEZA (no heurística):
 *   - ¿La parada P está en el recorrido de la línea L hacia destino D?
 *   - ¿Cuál es la posición ordinal (stop_sequence) de P en ese trip?
 *   - Lista ordenada de paradas de un trip → para calcular "paradas restantes"
 *
 * SRS FR-2.7+: filtro upstream basado en GTFS oficial.
 *
 * IMPORTANTE (deploy): antes esto leía gtfs-v2.db con **better-sqlite3**, un módulo
 * NATIVO de C++ que falla seguido en Netlify Functions (no compila / binario no carga
 * / prebuilds rotos en 12.x). Eso hacía que en producción las PARADAS y POIs (JSON puro)
 * anduvieran pero las RUTAS y recorridos NO. Ahora leemos `gtfs-v2.json` con fs como el
 * resto de los datos → cero módulos nativos → las rutas funcionan en prod igual que local.
 * El JSON se regenera con `scripts/export-gtfs-json.mjs` desde gtfs-v2.db.
 *
 * Estructura de gtfs-v2.json (índices precomputados, arrays compactos):
 *   variantsByLine[shortName] = [ {variantId, shortName, headsign, allHeadsigns, directionId} ]
 *   stopsByVariant[variantId] = [ [stopId, sequence, arrivalSeconds], ... ]  (ordenado)
 *   variantsByStop[stopId]    = [ [variantId, sequence], ... ]
 *   variantMeta[variantId]    = {variantId, shortName, headsign, allHeadsigns, directionId}
 *
 * Server-only. NO importar desde código cliente.
 */
import path from "path";
import fs from "fs";

interface VariantMeta {
  variantId: string;
  shortName: string;
  headsign: string;
  allHeadsigns: string;
  directionId: number | null;
}
interface GtfsIndex {
  variantsByLine: Record<string, VariantMeta[]>;
  stopsByVariant: Record<string, Array<[string, number, number]>>; // [stopId, seq, arrSec]
  variantsByStop: Record<string, Array<[string, number]>>;          // [variantId, seq]
  variantMeta: Record<string, VariantMeta>;
}

let _idx: GtfsIndex | null = null;
let _loadFailed = false;

/** Carga el índice GTFS desde JSON (una vez). Devuelve null si no está (degrada). */
function getIdx(): GtfsIndex | null {
  if (_idx) return _idx;
  if (_loadFailed) return null;
  try {
    const p = path.join(process.cwd(), "data", "gtfs-v2.json");
    if (!fs.existsSync(p)) {
      console.warn("[gtfs-db] no gtfs-v2.json found in data/");
      _loadFailed = true;
      return null;
    }
    _idx = JSON.parse(fs.readFileSync(p, "utf-8")) as GtfsIndex;
    return _idx;
  } catch (err) {
    console.error("[gtfs-db] error cargando gtfs-v2.json:", err);
    _loadFailed = true;
    return null;
  }
}

/** Normaliza nombres para matching tolerante (acentos, mayúsculas, paréntesis). */
export function normalizeHeadsign(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // quita acentos
    .replace(/\(.*?\)/g, " ")        // quita "(POR PARQUE ...)"
    .replace(/[^a-z0-9 ]/g, " ")     // simplifica símbolos
    .replace(/\s+/g, " ")
    .trim();
}

interface VariantInfo {
  variantId: string;
  shortName: string;
  headsign: string;
  directionId: number | null;
}

/**
 * Candidato de recorrido para una línea. A diferencia de VariantInfo (un solo
 * match), esto representa CADA recorrido distinto que tiene la línea, para que
 * el filtro de dirección (bus-direction-gtfs) elija el que mejor ajusta al GPS.
 */
export interface VariantCandidate {
  variantId: string;
  shortName: string;
  headsign: string;
  /** Headsigns alternativos separados por "|" (al menos contiene `headsign`). */
  allHeadsigns: string;
  directionId: number | null;
}

/** Elimina sufijos de día ("76 Sd", "124 D", "405 N") para matchear el short_name GTFS. */
function normalizeLineName(line: string): string {
  return line.replace(/\s+(Sd|Sa|D|N)$/i, "").trim();
}

/**
 * Todos los recorridos (variantes) de una línea. Normaliza el sufijo de día
 * ("124 Sd" → "124") antes de buscar, igual que findVariantForBus.
 *
 * Consumido por bus-direction-gtfs.ts: cada candidato se evalúa proyectando el
 * GPS del bus sobre sus paradas para elegir el recorrido físico real.
 */
export function getVariantsForLine(line: string): VariantCandidate[] {
  const idx = getIdx();
  if (!idx) return [];
  const normalizedLine = normalizeLineName(line);
  const rows = idx.variantsByLine[normalizedLine] || [];
  return rows.map((r) => ({
    variantId: r.variantId,
    shortName: r.shortName,
    headsign: r.headsign,
    allHeadsigns: r.allHeadsigns || r.headsign || "",
    directionId: r.directionId,
  }));
}

/**
 * Encuentra el variant_id que mejor corresponde al bus en vivo.
 * Match por (short_name exacto) + (headsign normalizado más cercano).
 *
 * Devuelve null si la línea no existe en GTFS o no hay variante con headsign similar.
 */
export function findVariantForBus(line: string, destination: string): VariantInfo | null {
  const idx = getIdx();
  if (!idx) return null;
  const normalizedLine = normalizeLineName(line);
  const rows = idx.variantsByLine[normalizedLine] || [];
  if (rows.length === 0) return null;

  const target = normalizeHeadsign(destination);
  if (!target) return rows[0] ? toInfo(rows[0]) : null;

  // 1. Match exacto normalizado
  let best = rows.find((r) => normalizeHeadsign(r.headsign) === target);
  // 2. Match por inclusión (uno contiene al otro)
  if (!best) {
    best = rows.find((r) => {
      const n = normalizeHeadsign(r.headsign);
      return n.includes(target) || target.includes(n);
    });
  }
  // 3. Match por primera palabra coincidente
  if (!best) {
    const firstWord = target.split(" ")[0];
    best = rows.find((r) => normalizeHeadsign(r.headsign).startsWith(firstWord));
  }
  // 4. Fallback: cualquier variante de esa línea
  if (!best) best = rows[0];
  return toInfo(best);
}

function toInfo(r: VariantMeta): VariantInfo {
  return {
    variantId: r.variantId,
    shortName: r.shortName,
    headsign: r.headsign,
    directionId: r.directionId,
  };
}

/**
 * Posición ordinal de una parada en una variante.
 * Devuelve null si la parada NO está en el recorrido (= bus va por otra ruta).
 */
export function getStopSequence(variantId: string, stopId: string | number): number | null {
  const idx = getIdx();
  if (!idx) return null;
  const stops = idx.stopsByVariant[variantId];
  if (!stops) return null;
  const sid = String(stopId);
  for (const [s, seq] of stops) if (s === sid) return seq;
  return null;
}

interface StopOfVariant {
  stopId: string;
  sequence: number;
  arrivalSeconds: number;
}

/** Lista completa de paradas de una variante en orden de recorrido. */
export function getStopsForVariant(variantId: string): StopOfVariant[] {
  const idx = getIdx();
  if (!idx) return [];
  const stops = idx.stopsByVariant[variantId];
  if (!stops) return [];
  return stops.map(([stopId, sequence, arrivalSeconds]) => ({ stopId, sequence, arrivalSeconds }));
}

/** ¿Esta variante pasa por esta parada? */
export function variantPassesStop(variantId: string, stopId: string | number): boolean {
  return getStopSequence(variantId, stopId) !== null;
}

/** Para una parada y una línea: lista de variantes (variant_id+headsign+seq) que la sirven. */
export function getServingVariants(stopId: string | number, shortName: string): Array<{
  variantId: string;
  headsign: string;
  sequence: number;
  directionId: number | null;
}> {
  const idx = getIdx();
  if (!idx) return [];
  const byStop = idx.variantsByStop[String(stopId)];
  if (!byStop) return [];
  const out: Array<{ variantId: string; headsign: string; sequence: number; directionId: number | null }> = [];
  for (const [variantId, sequence] of byStop) {
    const m = idx.variantMeta[variantId];
    if (m && m.shortName === shortName) {
      out.push({ variantId, headsign: m.headsign, sequence, directionId: m.directionId });
    }
  }
  return out;
}

/** TODAS las variantes que pasan por una parada (sin filtrar por línea). */
export function getAllVariantsAtStop(stopId: string | number): Array<{
  variantId: string;
  shortName: string;
  headsign: string;
  sequence: number;
  arrivalSeconds: number;
}> {
  const idx = getIdx();
  if (!idx) return [];
  const byStop = idx.variantsByStop[String(stopId)];
  if (!byStop) return [];
  const out: Array<{ variantId: string; shortName: string; headsign: string; sequence: number; arrivalSeconds: number }> = [];
  for (const [variantId, sequence] of byStop) {
    const m = idx.variantMeta[variantId];
    if (!m) continue;
    // arrival_seconds de ESTA parada en la variante (lookup en stopsByVariant).
    let arrivalSeconds = 0;
    const stops = idx.stopsByVariant[variantId];
    if (stops) for (const [s, , arr] of stops) if (s === String(stopId)) { arrivalSeconds = arr; break; }
    out.push({ variantId, shortName: m.shortName, headsign: m.headsign, sequence, arrivalSeconds });
  }
  return out;
}

/** Paradas de una variante entre dos secuencias (inclusivo). Útil para polylines. */
export function getStopsBetween(
  variantId: string,
  fromSeq: number,
  toSeq: number
): Array<{ stopId: string; sequence: number; arrivalSeconds: number }> {
  const idx = getIdx();
  if (!idx) return [];
  const stops = idx.stopsByVariant[variantId];
  if (!stops) return [];
  const out: Array<{ stopId: string; sequence: number; arrivalSeconds: number }> = [];
  for (const [stopId, sequence, arrivalSeconds] of stops) {
    if (sequence >= fromSeq && sequence <= toSeq) out.push({ stopId, sequence, arrivalSeconds });
  }
  out.sort((a, b) => a.sequence - b.sequence);
  return out;
}

/** Devuelve los stops AGUAS ABAJO desde un stop dado en una variante. */
export function getDownstreamStops(variantId: string, fromSequence: number): Array<{
  stopId: string;
  sequence: number;
  arrivalSeconds: number;
}> {
  const idx = getIdx();
  if (!idx) return [];
  const stops = idx.stopsByVariant[variantId];
  if (!stops) return [];
  const out: Array<{ stopId: string; sequence: number; arrivalSeconds: number }> = [];
  for (const [stopId, sequence, arrivalSeconds] of stops) {
    if (sequence > fromSequence) out.push({ stopId, sequence, arrivalSeconds });
  }
  out.sort((a, b) => a.sequence - b.sequence);
  return out;
}
