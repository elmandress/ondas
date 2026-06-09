/**
 * Consulta de horario operativo de una línea de bus.
 *
 * Lee data/line-hours.json (~10KB, bundled en serverless) generado por
 * `scripts/build-line-hours.js`. Permite responder con datos reales:
 *   - "¿La línea 495 está operando AHORA?"
 *   - "¿La línea 495 pasa en los próximos 90 min?"
 *
 * Motivación: muchas líneas (495, 192, 199 nocturnos) solo operan en
 * franjas específicas. Recomendar tomar la 495 a las 14h en el "Cómo Llegar"
 * confunde al usuario porque no pasa hasta las 23:30. Filtramos upstream.
 *
 * Server-only (lee archivo del disco al primer uso). Cache en módulo.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require("fs") as typeof import("fs");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require("path") as typeof import("path");

const QUARTERS = 96;

let _cache: Record<string, { 1?: string; 2?: string; 3?: string }> | null = null;

function getData(): Record<string, { 1?: string; 2?: string; 3?: string }> {
  if (_cache) return _cache;
  const FILE = path.join(process.cwd(), "data", "line-hours.json");
  if (!fs.existsSync(FILE)) {
    console.warn("[line-hours] line-hours.json no existe; filtros horarios desactivados");
    _cache = {};
    return _cache;
  }
  try {
    _cache = JSON.parse(fs.readFileSync(FILE, "utf-8"));
    return _cache!;
  } catch (err) {
    console.error("[line-hours] error parseando:", err);
    _cache = {};
    return _cache;
  }
}

/** 1 = HABIL (L-V), 2 = SABADO, 3 = DOMINGO/FERIADO. */
export type TipoDia = 1 | 2 | 3;

function fmtMin(min: number): string {
  const h = Math.floor(min / 60), m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Ventana de servicio de una línea para un tipo de día: primer y último horario operativo
 * (formato HH:MM). Para responder "¿a qué hora pasa el primer/último 103?" — búsqueda real,
 * con dato del GTFS (no inventado). Devuelve null si no hay datos de esa línea.
 */
export function getServiceWindow(line: string, tipoDia: TipoDia = 1): { first: string; last: string } | null {
  const data = getData();
  const entry = data[line];
  const b64 = entry?.[tipoDia];
  if (!b64) return null;
  const bytes = decodeBitset(b64);
  let firstQ = -1, lastQ = -1;
  for (let q = 0; q < QUARTERS; q++) {
    if (bitAt(bytes, q)) { if (firstQ === -1) firstQ = q; lastQ = q; }
  }
  if (firstQ === -1) return null;
  return { first: fmtMin(firstQ * 15), last: fmtMin((lastQ + 1) * 15) };
}

/** Uruguay = UTC-3 permanente (sin DST desde 2015). Devuelve "ahora" en hora MVD. */
function nowMvd(): Date { return new Date(Date.now() - 3 * 60 * 60 * 1000); }

/**
 * date debe estar en hora MVD (usar nowMvd() o ajustar con -3h). Usa getUTCDay()
 * para extraer el día correcto sin depender del timezone del servidor.
 */
export function getTipoDia(date: Date = nowMvd()): TipoDia {
  const day = date.getUTCDay();
  if (day === 0) return 3;
  if (day === 6) return 2;
  return 1;
}

function decodeBitset(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, "base64"));
}

function bitAt(bytes: Uint8Array, quarter: number): boolean {
  return (bytes[Math.floor(quarter / 8)] & (1 << (quarter % 8))) !== 0;
}

function minutesToQuarter(min: number): number {
  // Normalizar a [0, 1440) y dividir por 15
  const m = ((min % 1440) + 1440) % 1440;
  return Math.floor(m / 15);
}

export interface LineHoursLookup {
  /** ¿La línea opera en el rango [start, end] de minutos del día (mod 1440)? */
  operatesBetween: (line: string, startMin: number, endMin: number) => boolean;
  /** ¿La línea opera en este momento o dentro de los próximos N min? */
  operatesNowOrSoon: (line: string, windowMinutes?: number) => boolean;
  /** Saber si tenemos datos de la línea (si no, no la filtramos — fail open). */
  hasData: (line: string) => boolean;
  /**
   * Último cuarto operativo del bloque actual (en minutos del día, 0-1439).
   * Si la línea opera ahora y sigue operando en cuartos consecutivos hasta hora X,
   * devuelve X. Si no opera ahora, devuelve null.
   * Útil para mostrar "última corrida ~HH:MM" en la UI.
   */
  endOfCurrentBlock: (line: string) => number | null;
  /** Helper UI: ¿la línea cierra dentro de los próximos N min? (default 45min) */
  closingSoon: (line: string, withinMinutes?: number) => boolean;
}

/**
 * Devuelve un helper precomputado con el tipoDia y los datos cargados.
 * Hacer 1 sola vez por request para evitar re-lecturas redundantes.
 */
/**
 * now debe estar en hora MVD (usar nowMvd() o ajustar con -3h).
 * Usa getUTCHours/getUTCMinutes para leer la hora MVD correctamente.
 */
export function getLineHoursLookup(now: Date = nowMvd()): LineHoursLookup {
  const data = getData();
  const tipo = getTipoDia(now);
  const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes();

  function bytesFor(line: string): Uint8Array | null {
    const entry = data[line];
    if (!entry) return null;
    const b64 = entry[tipo];
    if (!b64) return null;
    return decodeBitset(b64);
  }

  function operatesBetween(line: string, startMin: number, endMin: number): boolean {
    const bytes = bytesFor(line);
    if (!bytes) return true; // fail open: si no hay datos, no filtrar
    const startQ = minutesToQuarter(startMin);
    const endQ = minutesToQuarter(endMin);
    // El rango puede cruzar medianoche: si endQ < startQ, son 2 segmentos
    if (endQ >= startQ) {
      for (let q = startQ; q <= endQ; q++) {
        if (bitAt(bytes, q)) return true;
      }
    } else {
      for (let q = startQ; q < QUARTERS; q++) if (bitAt(bytes, q)) return true;
      for (let q = 0; q <= endQ; q++) if (bitAt(bytes, q)) return true;
    }
    return false;
  }

  function operatesNowOrSoon(line: string, windowMinutes: number = 90): boolean {
    return operatesBetween(line, nowMin, nowMin + windowMinutes);
  }

  function hasData(line: string): boolean {
    const entry = data[line];
    return !!(entry && (entry[1] || entry[2] || entry[3]));
  }

  function endOfCurrentBlock(line: string): number | null {
    const bytes = bytesFor(line);
    if (!bytes) return null;
    const nowQ = minutesToQuarter(nowMin);
    if (!bitAt(bytes, nowQ)) return null;
    // Avanzar mientras los cuartos siguen prendidos (consecutivos).
    // Cortar tras 1 cuarto apagado para tolerar huecos chiquitos (15min de gap).
    let last = nowQ;
    let gap = 0;
    for (let q = nowQ + 1; q < QUARTERS; q++) {
      if (bitAt(bytes, q)) {
        last = q;
        gap = 0;
      } else {
        gap++;
        if (gap >= 2) break; // 30min apagados = bloque cerrado
      }
    }
    // Devolver el inicio del cuarto siguiente al último activo (= hora de cierre)
    return (last + 1) * 15;
  }

  function closingSoon(line: string, withinMinutes: number = 45): boolean {
    const end = endOfCurrentBlock(line);
    if (end === null) return false;
    const minsUntilClose = end - nowMin;
    return minsUntilClose > 0 && minsUntilClose <= withinMinutes;
  }

  return { operatesBetween, operatesNowOrSoon, hasData, endOfCurrentBlock, closingSoon };
}
