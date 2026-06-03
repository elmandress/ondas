/**
 * Tabla de TARIFAS del transporte de Montevideo y área metropolitana.
 *
 * Fuente OFICIAL (verificada jun 2026): cutcsa.com.uy/informacion/tarifas + portal IM.
 *  - URBANO Montevideo: vigente desde 05/01/2026 (sin cambios a jun 2026).
 *  - SUBURBANO/metropolitano: AUMENTÓ el 01/06/2026 (MTOP) — valores nuevos abajo.
 *
 * Centralizada con fecha de vigencia y tipos de boleto, para no hardcodear un único
 * valor disperso. La app muestra "Tarifa estimada — valores vigentes a junio 2026".
 * Honestidad: es orientativo; la tarifa real la cobra el STM según la tarjeta y categoría.
 */

export const FARE_VIGENCIA = "junio 2026";

/** Tarifas URBANAS de Montevideo (UYU). Boleto de 1 hora = permite 1 transbordo en 60 min. */
export const URBAN_FARES = {
  /** Común con tarjeta STM (= boleto 1 hora con tarjeta). */
  comun_stm: 52,
  /** Efectivo (no permite el beneficio de 1 hora salvo el boleto de 1h en efectivo). */
  comun_efectivo: 64,
  /** Boleto de 1 hora — tarjeta / efectivo. */
  hora_stm: 52,
  hora_efectivo: 64,
  /** Jubilados y pensionistas (electrónico / efectivo). */
  jubilado_a_stm: 14,
  jubilado_a_efectivo: 17,
  jubilado_b_stm: 23,
  jubilado_b_efectivo: 26,
  /** Estudiantes (solo tarjeta STM). */
  estudiante_a: 28.5,
  estudiante_b: 39.9,
} as const;

/** Tarifas SUBURBANAS / metropolitanas (UYU) — vigentes desde 01/06/2026 (MTOP). */
export const SUBURBAN_FARES = {
  dentro_mvd: 86,        // recorridos dentro de Montevideo
  hasta_32km: 107,
  hasta_40km: 127,
  hasta_60km: 153,
  jubilado: 45,          // jubilados/pensionistas (sin cambios)
} as const;

export interface FareEstimate {
  /** Precio con tarjeta STM (común/1h). */
  stm: number;
  /** Precio en efectivo. */
  cash: number;
  /** true si es un solo boleto seguro; false si podría requerir 2 (2+ transbordos > 1h). */
  exact: boolean;
  /** true si el viaje es suburbano/metropolitano (tarifa distinta). */
  suburban: boolean;
}

/**
 * Estima el costo de una ruta urbana de Montevideo.
 * El boleto de 1 hora cubre 1 transbordo → 0-1 transbordos = 1 boleto.
 * 2+ transbordos podrían exceder los 60 min → "desde" (exact:false).
 */
export function estimateFare(numTransfers: number, suburban = false): FareEstimate {
  if (suburban) {
    return { stm: SUBURBAN_FARES.dentro_mvd, cash: SUBURBAN_FARES.dentro_mvd, exact: false, suburban: true };
  }
  const exact = numTransfers <= 1;
  return { stm: URBAN_FARES.hora_stm, cash: URBAN_FARES.hora_efectivo, exact, suburban: false };
}

/** Texto corto para la UI: "$52 con tarjeta" / "desde $52" / "~$86 (suburbano)". */
export function fareLabel(numTransfers: number, suburban = false): string {
  const f = estimateFare(numTransfers, suburban);
  if (f.suburban) return `~$${f.stm} (suburbano)`;
  return f.exact ? `$${f.stm} con tarjeta` : `desde $${f.stm} con tarjeta`;
}
