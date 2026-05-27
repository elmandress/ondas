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

export function getTipoDia(date: Date = new Date()): TipoDia {
  const day = date.getDay();
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
}

/**
 * Devuelve un helper precomputado con el tipoDia y los datos cargados.
 * Hacer 1 sola vez por request para evitar re-lecturas redundantes.
 */
export function getLineHoursLookup(now: Date = new Date()): LineHoursLookup {
  const data = getData();
  const tipo = getTipoDia(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();

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

  return { operatesBetween, operatesNowOrSoon, hasData };
}
