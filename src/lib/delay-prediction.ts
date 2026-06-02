/**
 * Confianza y predicción HONESTA (F1.4).
 *
 * Principio #1 del proyecto: NUNCA inventar datos. Acá eso significa:
 *  - "Último bus": dato duro de schedule.db (la última corrida programada del día).
 *    Sin ambigüedad → lo afirmamos.
 *  - "Atraso": solo el atraso OBSERVADO AHORA (bus en vivo vs su horario programado
 *    más cercano). Es un hecho del momento, etiquetado "en vivo", no una predicción
 *    histórica fabricada. NO tenemos un almacén histórico de atrasos, así que NO
 *    mostramos "suele venir tarde" con un número inventado. Si en el futuro se
 *    registra histórico real (F5 comunidad / telemetría propia), se enchufa acá.
 *
 * Funciones puras y server-agnósticas: reciben los datos ya consultados.
 */

/** Umbral para considerar "el último del día" relevante de avisar (min). */
const LAST_BUS_WARN_WINDOW_MIN = 120;

/** Atraso mínimo (min) para que valga la pena mostrarlo como aviso. */
const DELAY_MIN_NOTABLE = 3;

export interface LastBusInfo {
  /** true si esta llegada es (con alta confianza) la última corrida del día. */
  isLastOfDay: boolean;
  /** Minuto del día de la última corrida programada (para mostrar la hora). */
  lastHora: number | null;
}

/**
 * ¿Esta llegada es la última corrida del día de su línea en esta parada?
 *
 * @param arrivalHora minuto del día de la llegada mostrada (programada o estimada
 *                    desde el ETA en vivo). Si es en vivo, pasar nowMin + eta.
 * @param lastHora    última hora programada del día (getLastDepartureForLine).
 * @param nowMin      minuto del día actual.
 */
export function detectLastBus(
  arrivalHora: number | null,
  lastHora: number | null,
  nowMin: number
): LastBusInfo {
  if (lastHora == null) return { isLastOfDay: false, lastHora: null };
  // schedule.db codifica las corridas nocturnas del DÍA OPERATIVO con horas >1440
  // (ej. 24:30 = 1470 = 0:30 AM, que "pertenece" al servicio del día anterior). Si
  // estamos en la madrugada (nowMin < 300 ≈ antes de 5 AM) y la última corrida está
  // en ese rango >1440, comparamos en la misma escala sumando un día a "ahora".
  const nowEff = nowMin < 300 && lastHora > 1440 ? nowMin + 1440 : nowMin;
  // Solo avisamos cerca del fin de servicio (no a las 3 de la tarde).
  if (lastHora - nowEff > LAST_BUS_WARN_WINDOW_MIN) return { isLastOfDay: false, lastHora };
  if (lastHora - nowEff < -5) return { isLastOfDay: false, lastHora }; // ya pasó el fin
  // Es la última si su hora coincide (±4 min) con la última programada.
  const arrivalEff = arrivalHora != null && nowMin < 300 && lastHora > 1440 ? arrivalHora + 1440 : arrivalHora;
  const isLast = arrivalEff != null && Math.abs(arrivalEff - lastHora) <= 4;
  return { isLastOfDay: isLast, lastHora };
}

export interface ObservedDelay {
  /** Minutos de atraso observado AHORA (positivo = tarde). null si no aplica. */
  delayMin: number | null;
  /** Etiqueta honesta para la UI. */
  label: string | null;
}

/**
 * Atraso OBSERVADO de un bus en vivo respecto a su horario programado más cercano.
 * Es un hecho del momento (no una predicción). Solo se devuelve para llegadas en vivo
 * y cuando el atraso es notable. Adelantos (negativo) no se muestran como "problema".
 *
 * @param liveEtaMin     ETA del bus en vivo (min desde ahora).
 * @param scheduledHora  hora programada más cercana a esa llegada (min del día), o null.
 * @param nowMin         minuto del día actual.
 */
export function observedDelay(
  liveEtaMin: number,
  scheduledHora: number | null,
  nowMin: number
): ObservedDelay {
  if (scheduledHora == null) return { delayMin: null, label: null };
  const liveHora = nowMin + liveEtaMin;
  const delay = liveHora - scheduledHora;
  if (delay < DELAY_MIN_NOTABLE) return { delayMin: delay, label: null };
  // Etiqueta honesta: es lo que está pasando AHORA, medido, no un promedio inventado.
  return { delayMin: delay, label: `~${delay} min tarde (en vivo)` };
}
