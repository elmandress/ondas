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

let _db: any = null;
let _variantToLine: Record<string, string> | null = null;

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
    const Database = require("better-sqlite3");
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

export type TipoDia = 1 | 2 | 3; // 1=HABIL, 2=SABADO, 3=DOMINGO

export function getTipoDia(date: Date = new Date()): TipoDia {
  const day = date.getDay(); // 0=domingo, 6=sábado
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

export function getScheduledArrivals(
  stopId: string,
  tipoDia?: TipoDia,
  nowMinutes?: number,
  windowMinutes = 120
): ScheduledArrival[] {
  const db = getDb();
  if (!db) return [];

  const variantToLine = getVariantToLine();
  const tipo = tipoDia ?? getTipoDia();

  const now = new Date();
  const currentMinutes = nowMinutes ?? (now.getHours() * 60 + now.getMinutes());

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
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
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
export function getNextScheduledPerLine(
  stopId: string,
  lineCodes: string[],
  windowMinutes = 180
): ScheduledArrival[] {
  if (!lineCodes.length) return [];
  // Conseguir todos los horarios próximos y agrupar por línea, quedándose
  // con el más temprano por línea
  const allScheduled = getScheduledArrivalsForStop(stopId);
  // Si el helper ya filtró por la ventana default, conseguimos más con un override
  const tipo = getTipoDia();
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const extended = getScheduledArrivals(stopId, tipo, currentMinutes, windowMinutes);
  const pool = extended.length >= allScheduled.length ? extended : allScheduled;

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
