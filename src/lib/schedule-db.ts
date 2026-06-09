/**
 * Acceso al SQLite de horarios programados (uptu_pasada_variante).
 * Solo se usa en server-side (API routes de Next.js).
 * NO importar este módulo desde componentes cliente ni desde stm.ts.
 *
 * Schema: schedules(tipo_dia, cod_variante, parada, hora)
 *   tipo_dia: 1=HABIL, 2=SABADO, 3=DOMINGO
 *   hora: minutos desde medianoche (643 = 10:43)
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require("path") as typeof import("path");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require("fs") as typeof import("fs");

import type DatabaseType from "better-sqlite3";

let _db: DatabaseType.Database | null = null;
let _metroDb: DatabaseType.Database | null = null;
let _metroDbTried = false;
let _variantToLine: Record<string, string> | null = null;
let _lineToVariants: Record<string, string[]> | null = null;

/** metro-schedule.db: horarios de paso de las líneas metropolitanas (Canelones).
 *  schedule.db (MVD) usa cod_variante numéricos y solo cubre paradas de Montevideo;
 *  las paradas metro (stop_id "M…") viven acá. Schema: schedules(stop_id,line,tipo_dia,hora). */
function getMetroDb() {
  if (_metroDb) return _metroDb;
  if (_metroDbTried) return null;
  _metroDbTried = true;
  const DB_PATH = path.join(process.cwd(), "data", "metro-schedule.db");
  if (!fs.existsSync(DB_PATH)) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require("better-sqlite3") as typeof DatabaseType;
    _metroDb = new Database(DB_PATH, { readonly: true, fileMustExist: true });
    return _metroDb;
  } catch (err) {
    console.warn("[schedule-db] no se pudo abrir metro-schedule.db:", err);
    return null;
  }
}

/** Uruguay = UTC-3 permanente (sin DST desde 2015). Devuelve "ahora" en hora MVD. */
function nowMvd(): Date { return new Date(Date.now() - 3 * 60 * 60 * 1000); }

/** ¿Es una parada metropolitana (Canelones)? Sus stop_id llevan prefijo "M". */
function isMetroStop(stopId: string): boolean {
  return stopId.startsWith("M");
}

/** Horarios de paso programados de una parada METRO, ya como ScheduledArrival. */
function getMetroScheduled(
  stopId: string,
  refMinutes: number,
  windowMinutes: number,
  tipoDia: TipoDia,
  lineFilter?: Set<string>,
): ScheduledArrival[] {
  const db = getMetroDb();
  if (!db) return [];
  const minHora = refMinutes - 2;
  const maxHora = refMinutes + windowMinutes;
  try {
    const rows = db.prepare(
      `SELECT line, hora FROM schedules
       WHERE stop_id = ? AND tipo_dia = ? AND hora >= ? AND hora <= ?
       ORDER BY hora ASC LIMIT 60`
    ).all(stopId, tipoDia, minHora, maxHora) as { line: string; hora: number }[];
    const out: ScheduledArrival[] = [];
    for (const r of rows) {
      if (lineFilter && !lineFilter.has(r.line)) continue;
      const hh = Math.floor(r.hora / 60), mm = r.hora % 60;
      out.push({
        variantCode: "", lineCode: r.line, hora: r.hora,
        horaStr: `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`,
        minutesFromNow: r.hora - refMinutes,
      });
    }
    return out;
  } catch (err) {
    console.error("[metro-schedule] query error:", err);
    return [];
  }
}

function getDb() {
  if (_db) return _db;
  // schedule.db (84MB) NO se incluye en bundle serverless por tamaño.
  // En producción serverless, el fallback de horarios no está disponible
  // — la app sigue funcionando con API live + GTFS sin problema.
  // Migrar a usar arrival_seconds del GTFS (queda pendiente).
  const DB_PATH = path.join(process.cwd(), "data", "schedule.db");
  if (!fs.existsSync(DB_PATH)) {
    // No es error en prod, es esperado
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require("better-sqlite3") as typeof DatabaseType;
    _db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
    return _db;
  } catch (err) {
    console.warn("[schedule-db] no se pudo abrir schedule.db:", err);
    return null;
  }
}

function getVariantToLine(): Record<string, string> {
  if (_variantToLine) return _variantToLine;
  const MAP_PATH = path.join(process.cwd(), "data", "variant_to_line.json");
  if (!fs.existsSync(MAP_PATH)) return {};
  _variantToLine = JSON.parse(fs.readFileSync(MAP_PATH, "utf-8"));
  return _variantToLine!;
}

/** Reverso cacheado: lineCode → [cod_variante, ...]. Para querys por línea. */
function getLineToVariants(): Record<string, string[]> {
  if (_lineToVariants) return _lineToVariants;
  const v2l = getVariantToLine();
  const map: Record<string, string[]> = {};
  for (const [variant, line] of Object.entries(v2l)) {
    (map[line] ||= []).push(variant);
  }
  _lineToVariants = map;
  return map;
}

export type TipoDia = 1 | 2 | 3; // 1=HABIL, 2=SABADO, 3=DOMINGO

/**
 * date debe estar en hora MVD (usar nowMvd() o ajustar con -3h). Usa getUTCDay()
 * para extraer el día correcto sin depender del timezone del servidor.
 */
export function getTipoDia(date: Date = nowMvd()): TipoDia {
  const day = date.getUTCDay(); // 0=domingo, 6=sábado
  if (day === 0) return 3;
  if (day === 6) return 2;
  return 1;
}

export interface ScheduledArrival {
  variantCode: string;
  lineCode: string;
  hora: number;
  horaStr: string;
  minutesFromNow: number;
}

/**
 * Última corrida PROGRAMADA del día de una línea en una parada (minuto del día).
 * Dato 100% honesto (viene de schedule.db). null si no hay servicio hoy.
 * Sirve para el "modo último bus": avisar que un servicio es el último.
 */
export function getLastDepartureForLine(
  stopId: string,
  lineCode: string,
  tipoDia?: TipoDia
): number | null {
  const db = getDb();
  if (!db) return null;
  const variants = getLineToVariants()[lineCode];
  if (!variants || !variants.length) return null;
  const tipo = tipoDia ?? getTipoDia();
  try {
    const placeholders = variants.map(() => "?").join(",");
    const row = db.prepare(
      `SELECT MAX(hora) AS lastHora
       FROM schedules
       WHERE parada = ? AND tipo_dia = ? AND cod_variante IN (${placeholders})`
    ).get(stopId, tipo, ...variants) as { lastHora: number | null };
    return row?.lastHora ?? null;
  } catch (err) {
    console.error("[schedule-db] getLastDepartureForLine error:", err);
    return null;
  }
}

export function getScheduledArrivals(
  stopId: string,
  tipoDia?: TipoDia,
  nowMinutes?: number,
  windowMinutes = 120
): ScheduledArrival[] {
  const tipo = tipoDia ?? getTipoDia();
  const mvd0 = nowMvd();
  const currentMin0 = nowMinutes ?? (mvd0.getUTCHours() * 60 + mvd0.getUTCMinutes());

  // Parada metropolitana (Canelones): su horario vive en metro-schedule.db.
  if (isMetroStop(stopId)) {
    return getMetroScheduled(stopId, currentMin0, windowMinutes, tipo);
  }

  const db = getDb();
  if (!db) return [];

  const variantToLine = getVariantToLine();

  const mvd = nowMvd();
  const currentMinutes = nowMinutes ?? (mvd.getUTCHours() * 60 + mvd.getUTCMinutes());

  const minHora = currentMinutes - 2;
  const maxHora = currentMinutes + windowMinutes;

  try {
    const rows = db.prepare(
      `SELECT DISTINCT cod_variante, hora
       FROM schedules
       WHERE parada = ? AND tipo_dia = ? AND hora >= ? AND hora <= ?
       ORDER BY hora ASC
       LIMIT 40`
    ).all(stopId, tipo, minHora, maxHora) as { cod_variante: string; hora: number }[];

    return rows.map((row: { cod_variante: string; hora: number }) => {
      const hh = Math.floor(row.hora / 60);
      const mm = row.hora % 60;
      const lineCode = variantToLine[row.cod_variante] || row.cod_variante;
      return {
        variantCode: row.cod_variante,
        lineCode,
        hora: row.hora,
        horaStr: `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`,
        minutesFromNow: row.hora - currentMinutes,
      };
    });
  } catch (err) {
    console.error("[schedule-db] query error:", err);
    return [];
  }
}

export function getScheduledArrivalsForStop(stopId: string): ScheduledArrival[] {
  const tipo = getTipoDia();
  const mvd = nowMvd();
  const currentMinutes = mvd.getUTCHours() * 60 + mvd.getUTCMinutes();
  const isEarlyMorning = currentMinutes < 360;
  const windowMin = isEarlyMorning ? 180 : 120;
  return getScheduledArrivals(stopId, tipo, currentMinutes, windowMin);
}

/**
 * Devuelve el próximo horario programado para cada línea pedida.
 * Si una línea no tiene servicio hoy, no aparece en el resultado.
 *
 * SRS FR-1.5: cada línea de la parada debe tener al menos un "próximo bus"
 * mostrado (sea live o scheduled), nunca silencio total mientras haya servicio.
 */
/**
 * Próximas N llegadas PROGRAMADAS de UNA línea en una parada, ordenadas.
 *
 * Es el dato detrás del "pager" estilo maprab: el usuario ya ve el próximo bus
 * (live o scheduled) en la fila; con ‹ › puede recorrer los siguientes horarios
 * programados de esa misma línea ("y el de después, ¿a qué hora?").
 *
 * Honesto: son horarios PROGRAMADOS (no posiciones en vivo). La ventana se
 * extiende hasta 8h para que haya varios para paginar incluso en horas valle.
 */
export function getNextScheduledForLine(
  stopId: string,
  lineCode: string,
  limit = 12,
  windowMinutes = 480
): ScheduledArrival[] {
  if (!lineCode) return [];
  const tipo0 = getTipoDia();
  const mvd0 = nowMvd();
  const curMin0 = mvd0.getUTCHours() * 60 + mvd0.getUTCMinutes();

  // Parada metropolitana: filtrar el metro-schedule por esta línea.
  if (isMetroStop(stopId)) {
    return getMetroScheduled(stopId, curMin0, windowMinutes, tipo0, new Set([lineCode])).slice(0, limit);
  }

  const db = getDb();
  if (!db) return [];

  const variants = getLineToVariants()[lineCode];
  if (!variants || !variants.length) return [];

  const tipo = tipo0;
  const currentMinutes = curMin0;
  const minHora = currentMinutes - 2;
  const maxHora = currentMinutes + windowMinutes;

  try {
    const placeholders = variants.map(() => "?").join(",");
    const rows = db.prepare(
      `SELECT DISTINCT cod_variante, hora
       FROM schedules
       WHERE parada = ? AND tipo_dia = ? AND hora >= ? AND hora <= ?
         AND cod_variante IN (${placeholders})
       ORDER BY hora ASC
       LIMIT ?`
    ).all(stopId, tipo, minHora, maxHora, ...variants, limit) as { cod_variante: string; hora: number }[];

    return rows.map((row) => {
      const hh = Math.floor(row.hora / 60);
      const mm = row.hora % 60;
      return {
        variantCode: row.cod_variante,
        lineCode,
        hora: row.hora,
        horaStr: `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`,
        minutesFromNow: row.hora - currentMinutes,
      };
    });
  } catch (err) {
    console.error("[schedule-db] getNextScheduledForLine error:", err);
    return [];
  }
}

export function getNextScheduledPerLine(
  stopId: string,
  lineCodes: string[],
  windowMinutes = 180,
  /** Minuto del día de referencia (0-1439). Default: ahora. Permite "salir a las 21:30". */
  refMinutes?: number,
  /** Tipo de día de referencia. Default: hoy. Para planificar a futuro en otro día. */
  refTipoDia?: TipoDia
): ScheduledArrival[] {
  if (!lineCodes.length) return [];
  const tipo = refTipoDia ?? getTipoDia();
  const mvd = nowMvd();
  const currentMinutes = refMinutes ?? (mvd.getUTCHours() * 60 + mvd.getUTCMinutes());
  const pool = getScheduledArrivals(stopId, tipo, currentMinutes, windowMinutes);

  // Mapa línea → próximo horario
  const seen = new Set<string>();
  const result: ScheduledArrival[] = [];
  const linesWanted = new Set(lineCodes);
  for (const s of pool) {
    if (!linesWanted.has(s.lineCode)) continue;
    if (seen.has(s.lineCode)) continue;
    seen.add(s.lineCode);
    result.push(s);
    if (result.length >= lineCodes.length) break;
  }
  return result;
}
