/**
 * Horarios programados (urbano + metropolitano) — JSON puro, sin módulos nativos.
 *
 * R60 — POR QUÉ esta reescritura: "próximos horarios" estaba MUERTO en producción.
 * Antes leía schedule.db / metro-schedule.db con better-sqlite3, un módulo NATIVO
 * C++ que no carga en Netlify Functions (schedule.db además ni se subía: 84MB).
 * Es la misma causa por la que el GTFS migró a JSON. Regla de arquitectura:
 * TODO dato en runtime = JSON leído con fs.
 *
 * Fuente: data/sched/shard-{0..31}.json, generados por
 * scripts/pipeline/export-schedules-json.mjs (re-correr al regenerar horarios).
 * Formato: { [stopId]: { [tipoDia]: { [LINEA_CANON]: "m1,m2,..." } } }
 *   - minutos del día asc; pueden superar 1440 (nocturnas del día operativo).
 *   - urbano y metro (paradas "M…") viven JUNTOS — ya no hay dos caminos.
 *
 * Lazy por shard (~450KB c/u) con cache de módulo: una parada solo paga su shard.
 * Solo server-side (API routes).
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require("path") as typeof import("path");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require("fs") as typeof import("fs");

import { canonLine } from "@/lib/line-name";

const SHARDS = 32;
type ShardData = Record<string, Record<string, Record<string, string>>>;
const _shards = new Map<number, ShardData | null>();

/** Mismo hash que el exporter (mantener sincronizados). */
function shardOf(stopId: string): number {
  let h = 0;
  for (let i = 0; i < stopId.length; i++) h = (h * 31 + stopId.charCodeAt(i)) >>> 0;
  return h % SHARDS;
}

function getStopEntry(stopId: string): Record<string, Record<string, string>> | null {
  const n = shardOf(stopId);
  if (!_shards.has(n)) {
    try {
      const p = path.join(process.cwd(), "data", "sched", `shard-${n}.json`);
      _shards.set(n, fs.existsSync(p) ? (JSON.parse(fs.readFileSync(p, "utf-8")) as ShardData) : null);
    } catch (err) {
      console.error(`[schedule-db] error cargando shard ${n}:`, err);
      _shards.set(n, null);
    }
  }
  return _shards.get(n)?.[stopId] ?? null;
}

/** Uruguay = UTC-3 permanente (sin DST desde 2015). Devuelve "ahora" en hora MVD. */
function nowMvd(): Date { return new Date(Date.now() - 3 * 60 * 60 * 1000); }

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

function toArrival(line: string, hora: number, refMinutes: number): ScheduledArrival {
  const hh = Math.floor((hora % 1440) / 60), mm = hora % 60;
  return {
    variantCode: "", // el pack agrupa por línea (la variante no se muestra en la UI)
    lineCode: line,
    hora,
    horaStr: `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`,
    minutesFromNow: hora - refMinutes,
  };
}

/**
 * Minutos de una línea dentro de [min, max], desde el string empaquetado.
 * Los horarios son minutos de día (0-1439); `max` puede pasar de 1440 (ventana que
 * cruza medianoche). Para que a las 23:55 aparezca el viaje de 00:15, probamos cada
 * valor TAMBIÉN sumándole 1440 (el día siguiente). Devuelve minutos relativos al día
 * de la consulta (00:15 del día siguiente → 1455), así minutesFromNow sale correcto.
 */
function minutesInWindow(packed: string, min: number, max: number): number[] {
  const out: number[] = [];
  for (const part of packed.split(",")) {
    const h = Number(part);
    if (h >= min && h <= max) out.push(h);
    else if (max > 1440 && h + 1440 >= min && h + 1440 <= max) out.push(h + 1440);
  }
  return out;
}

export function getScheduledArrivals(
  stopId: string,
  tipoDia?: TipoDia,
  nowMinutes?: number,
  windowMinutes = 120
): ScheduledArrival[] {
  const entry = getStopEntry(stopId);
  if (!entry) return [];
  const tipo = String(tipoDia ?? getTipoDia());
  const byLine = entry[tipo];
  if (!byLine) return [];

  const mvd = nowMvd();
  const currentMinutes = nowMinutes ?? (mvd.getUTCHours() * 60 + mvd.getUTCMinutes());
  const minHora = currentMinutes - 2;
  const maxHora = currentMinutes + windowMinutes;

  const out: ScheduledArrival[] = [];
  for (const [line, packed] of Object.entries(byLine)) {
    for (const h of minutesInWindow(packed, minHora, maxHora)) {
      out.push(toArrival(line, h, currentMinutes));
    }
  }
  out.sort((a, b) => a.hora - b.hora);
  return out.slice(0, 40);
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
 * Última corrida PROGRAMADA del día de una línea en una parada (minuto del día).
 * Dato 100% honesto. null si no hay servicio hoy. Para el "modo último bus".
 */
export function getLastDepartureForLine(
  stopId: string,
  lineCode: string,
  tipoDia?: TipoDia
): number | null {
  const entry = getStopEntry(stopId);
  if (!entry) return null;
  const byLine = entry[String(tipoDia ?? getTipoDia())];
  const packed = byLine?.[canonLine(lineCode)];
  if (!packed) return null;
  // El pack está ordenado asc → el último elemento es la última corrida.
  const idx = packed.lastIndexOf(",");
  return Number(idx === -1 ? packed : packed.slice(idx + 1));
}

/**
 * Próximas N llegadas PROGRAMADAS de UNA línea en una parada, ordenadas.
 * Es el dato detrás del "pager" (‹ ›) de horarios por línea. Ventana larga (8h)
 * para que haya varios para paginar incluso en horas valle. Honesto: programados.
 */
export function getNextScheduledForLine(
  stopId: string,
  lineCode: string,
  limit = 12,
  windowMinutes = 480
): ScheduledArrival[] {
  if (!lineCode) return [];
  const entry = getStopEntry(stopId);
  if (!entry) return [];
  const byLine = entry[String(getTipoDia())];
  const packed = byLine?.[canonLine(lineCode)];
  if (!packed) return [];

  const mvd = nowMvd();
  const currentMinutes = mvd.getUTCHours() * 60 + mvd.getUTCMinutes();
  return minutesInWindow(packed, currentMinutes - 2, currentMinutes + windowMinutes)
    .slice(0, limit)
    .map((h) => toArrival(lineCode, h, currentMinutes));
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

  // Próximo horario por línea pedida. Matching CANÓNICO entre fuentes; el resultado
  // conserva la grafía del CALLER (la UI/dedupe aguas arriba usa esa).
  const seen = new Set<string>();
  const result: ScheduledArrival[] = [];
  const wantedByCanon = new Map<string, string>();
  for (const lc of lineCodes) {
    const c = canonLine(lc);
    if (!wantedByCanon.has(c)) wantedByCanon.set(c, lc);
  }
  for (const s of pool) {
    const c = canonLine(s.lineCode);
    const requested = wantedByCanon.get(c);
    if (!requested) continue;
    if (seen.has(c)) continue;
    seen.add(c);
    result.push({ ...s, lineCode: requested });
    if (result.length >= lineCodes.length) break;
  }
  return result;
}
