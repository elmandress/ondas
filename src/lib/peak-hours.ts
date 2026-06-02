/**
 * peak-hours.ts — Conciencia de HORA PICO en Montevideo.
 *
 * Filosofía (honestidad, SRS FR-6.4): NO inventamos ETAs ni cambiamos números en
 * silencio. Solo damos un AVISO transparente de que, en hora pico, los buses suelen
 * ir más llenos y más lentos (más tránsito) — útil para interpretar un horario
 * PROGRAMADO (cuando no hay GPS en vivo, el horario puede quedar corto en pico).
 *
 * Ventanas (días hábiles, hora local de Montevideo / America/Montevideo, UTC-3):
 *  - Mañana: 07:00–09:00. Fuente oficial: IM, "Comportamiento del tránsito en
 *    Montevideo" — "la franja de 7 a 8 es habitualmente el pico laboral-escolar",
 *    con máximo de vehículos entre 8 y 9.
 *  - Tarde:  17:00–20:00. Pico de retorno/salida laboral. La IM no publicó conteos
 *    de tarde en ese informe, así que lo tratamos como ventana CONOCIDA de congestión
 *    vespertina, sin afirmar números concretos.
 *
 * Fines de semana: sin hora pico (el patrón laboral-escolar no aplica).
 *
 * Fuentes:
 *  - https://montevideo.gub.uy/noticias/movilidad-y-transporte/comportamiento-del-transito-en-montevideo
 */

export type PeakKind = "morning" | "evening";

export interface PeakStatus {
  isPeak: boolean;
  kind: PeakKind | null;
  /** Etiqueta corta para un chip, ej. "Hora pico · mañana". */
  label: string | null;
  /** Aviso honesto y breve para el usuario. */
  hint: string | null;
}

const NONE: PeakStatus = { isPeak: false, kind: null, label: null, hint: null };

/** Hora, minuto y si es fin de semana, en horario REAL de Montevideo (no del dispositivo). */
function montevideoParts(date: Date): { hour: number; isWeekend: boolean } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Montevideo",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  let hour = parseInt(get("hour"), 10);
  if (hour === 24) hour = 0; // algunos entornos devuelven "24" a medianoche
  const wd = get("weekday"); // "Mon" … "Sun"
  const isWeekend = wd === "Sat" || wd === "Sun";
  return { hour: Number.isFinite(hour) ? hour : new Date().getHours(), isWeekend };
}

/**
 * Estado de hora pico para un instante dado (por defecto, ahora).
 * Determinístico y sin efectos secundarios — fácil de testear.
 */
export function getPeakStatus(date: Date = new Date()): PeakStatus {
  const { hour, isWeekend } = montevideoParts(date);
  if (isWeekend) return NONE;

  const morning = hour >= 7 && hour < 9;
  const evening = hour >= 17 && hour < 20;

  if (morning) {
    return {
      isPeak: true,
      kind: "morning",
      label: "Hora pico · mañana",
      hint: "Más gente y más tránsito (7–9 h). Los buses pueden ir más llenos y demorar un poco más que el horario.",
    };
  }
  if (evening) {
    return {
      isPeak: true,
      kind: "evening",
      label: "Hora pico · tarde",
      hint: "Salida laboral (17–20 h): más demanda y tránsito. Tené margen; el horario puede quedar corto.",
    };
  }
  return NONE;
}
