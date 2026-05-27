/**
 * Acceso al SQLite GTFS pre-procesado (data/gtfs.db).
 *
 * Permite responder con CERTEZA (no heurística):
 *   - ¿La parada P está en el recorrido de la línea L hacia destino D?
 *   - ¿Cuál es la posición ordinal (stop_sequence) de P en ese trip?
 *   - Lista ordenada de paradas de un trip → para calcular "paradas restantes"
 *
 * SRS FR-2.7+ (NUEVO): filtro upstream basado en GTFS oficial.
 * Reemplaza la proyección polyline de `bus-direction.ts` que era una heurística.
 *
 * Schema (data/gtfs.db ~3MB):
 *   variants(variant_id, short_name, headsign, long_name, direction_id)
 *   variant_stops(variant_id, stop_sequence, stop_id, arrival_seconds)
 *
 * Server-only. NO importar desde código cliente.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require("path") as typeof import("path");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require("fs") as typeof import("fs");

let _db: any = null;

function getDb() {
  if (_db) return _db;
  const DB_PATH = path.join(process.cwd(), "data", "gtfs.db");
  if (!fs.existsSync(DB_PATH)) {
    console.warn("[gtfs-db] gtfs.db not found at", DB_PATH);
    return null;
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require("better-sqlite3");
  _db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
  return _db;
}

/** Normaliza nombres para matching tolerante (acentos, mayúsculas, paréntesis). */
export function normalizeHeadsign(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")        // quita acentos
    .replace(/\(.*?\)/g, " ")     // quita "(POR PARQUE ...)"
    .replace(/[^a-z0-9 ]/g, " ")  // simplifica símbolos
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
 * Encuentra el variant_id que mejor corresponde al bus en vivo.
 * Match por (short_name exacto) + (headsign normalizado más cercano).
 *
 * Devuelve null si la línea no existe en GTFS o no hay variante con headsign similar.
 */
export function findVariantForBus(line: string, destination: string): VariantInfo | null {
  const db = getDb();
  if (!db) return null;
  try {
    const rows = db.prepare(
      "SELECT variant_id, short_name, headsign, direction_id FROM variants WHERE short_name = ?"
    ).all(line) as { variant_id: string; short_name: string; headsign: string; direction_id: number | null }[];

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
  } catch (err) {
    console.error("[gtfs-db] findVariantForBus error:", err);
    return null;
  }
}

function toInfo(r: { variant_id: string; short_name: string; headsign: string; direction_id: number | null }): VariantInfo {
  return {
    variantId: r.variant_id,
    shortName: r.short_name,
    headsign: r.headsign,
    directionId: r.direction_id,
  };
}

/**
 * Posición ordinal de una parada en una variante.
 * Devuelve null si la parada NO está en el recorrido (= bus va por otra ruta).
 */
export function getStopSequence(variantId: string, stopId: string | number): number | null {
  const db = getDb();
  if (!db) return null;
  try {
    const row = db.prepare(
      "SELECT stop_sequence FROM variant_stops WHERE variant_id = ? AND stop_id = ?"
    ).get(variantId, String(stopId)) as { stop_sequence: number } | undefined;
    return row?.stop_sequence ?? null;
  } catch {
    return null;
  }
}

interface StopOfVariant {
  stopId: string;
  sequence: number;
  arrivalSeconds: number;
}

/** Lista completa de paradas de una variante en orden de recorrido. */
export function getStopsForVariant(variantId: string): StopOfVariant[] {
  const db = getDb();
  if (!db) return [];
  try {
    const rows = db.prepare(
      "SELECT stop_sequence, stop_id, arrival_seconds FROM variant_stops WHERE variant_id = ? ORDER BY stop_sequence"
    ).all(variantId) as { stop_sequence: number; stop_id: string; arrival_seconds: number }[];
    return rows.map((r) => ({
      stopId: r.stop_id,
      sequence: r.stop_sequence,
      arrivalSeconds: r.arrival_seconds,
    }));
  } catch {
    return [];
  }
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
  const db = getDb();
  if (!db) return [];
  try {
    const rows = db.prepare(`
      SELECT v.variant_id, v.headsign, vs.stop_sequence, v.direction_id
      FROM variant_stops vs
      JOIN variants v ON vs.variant_id = v.variant_id
      WHERE vs.stop_id = ? AND v.short_name = ?
    `).all(String(stopId), shortName) as { variant_id: string; headsign: string; stop_sequence: number; direction_id: number | null }[];
    return rows.map((r) => ({
      variantId: r.variant_id,
      headsign: r.headsign,
      sequence: r.stop_sequence,
      directionId: r.direction_id,
    }));
  } catch {
    return [];
  }
}

/** TODAS las variantes que pasan por una parada (sin filtrar por línea). */
export function getAllVariantsAtStop(stopId: string | number): Array<{
  variantId: string;
  shortName: string;
  headsign: string;
  sequence: number;
  arrivalSeconds: number;
}> {
  const db = getDb();
  if (!db) return [];
  try {
    const rows = db.prepare(`
      SELECT v.variant_id, v.short_name, v.headsign, vs.stop_sequence, vs.arrival_seconds
      FROM variant_stops vs
      JOIN variants v ON vs.variant_id = v.variant_id
      WHERE vs.stop_id = ?
    `).all(String(stopId)) as {
      variant_id: string; short_name: string; headsign: string;
      stop_sequence: number; arrival_seconds: number;
    }[];
    return rows.map((r) => ({
      variantId: r.variant_id,
      shortName: r.short_name,
      headsign: r.headsign,
      sequence: r.stop_sequence,
      arrivalSeconds: r.arrival_seconds,
    }));
  } catch {
    return [];
  }
}

/** Paradas de una variante entre dos secuencias (inclusivo). Útil para polylines. */
export function getStopsBetween(
  variantId: string,
  fromSeq: number,
  toSeq: number
): Array<{ stopId: string; sequence: number; arrivalSeconds: number }> {
  const db = getDb();
  if (!db) return [];
  try {
    const rows = db.prepare(`
      SELECT stop_id, stop_sequence, arrival_seconds
      FROM variant_stops
      WHERE variant_id = ? AND stop_sequence >= ? AND stop_sequence <= ?
      ORDER BY stop_sequence
    `).all(variantId, fromSeq, toSeq) as {
      stop_id: string; stop_sequence: number; arrival_seconds: number;
    }[];
    return rows.map((r) => ({
      stopId: r.stop_id,
      sequence: r.stop_sequence,
      arrivalSeconds: r.arrival_seconds,
    }));
  } catch {
    return [];
  }
}

/** Una sola pasada por stop: devuelve los stops AGUAS ABAJO desde un stop dado en una variante. */
export function getDownstreamStops(variantId: string, fromSequence: number): Array<{
  stopId: string;
  sequence: number;
  arrivalSeconds: number;
}> {
  const db = getDb();
  if (!db) return [];
  try {
    const rows = db.prepare(`
      SELECT stop_id, stop_sequence, arrival_seconds
      FROM variant_stops
      WHERE variant_id = ? AND stop_sequence > ?
      ORDER BY stop_sequence
    `).all(variantId, fromSequence) as {
      stop_id: string; stop_sequence: number; arrival_seconds: number;
    }[];
    return rows.map((r) => ({
      stopId: r.stop_id,
      sequence: r.stop_sequence,
      arrivalSeconds: r.arrival_seconds,
    }));
  } catch {
    return [];
  }
}
