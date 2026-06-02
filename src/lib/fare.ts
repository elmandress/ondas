/**
 * Tarifas del transporte urbano de Montevideo (dato OFICIAL, no inventado).
 *
 * Fuente: montevideo.gub.uy — "Nuevas tarifas del transporte colectivo urbano",
 * vigentes desde el 5 de enero de 2026. Boleto de 1 HORA (permite 1 transbordo
 * dentro de los 60 min): $52 con tarjeta STM, $64 en efectivo.
 *
 * Honestidad: mostramos el costo del boleto de 1 hora. Como ese boleto cubre 1
 * transbordo, una ruta directa o con 1 transbordo cuesta 1 boleto. No afirmamos el
 * total exacto de viajes muy largos con 2+ transbordos que excedan la hora (raro):
 * en ese caso lo aclaramos como "desde". Es orientativo, la tarifa real la cobra el STM.
 */

export const FARE_STM_1H = 52;   // boleto de 1 hora con tarjeta STM (UYU)
export const FARE_CASH_1H = 64;  // boleto de 1 hora en efectivo (UYU)
export const FARE_VIGENCIA = "ene 2026";

/**
 * Estima el costo de una ruta. El boleto de 1 hora cubre 1 transbordo, así que
 * 0–1 transbordos = 1 boleto. 2+ transbordos podrían ser 2 boletos si exceden la
 * hora → lo marcamos como "desde" (exact: false) para no afirmar de más.
 */
export function estimateFare(numTransfers: number): { stm: number; cash: number; exact: boolean } {
  if (numTransfers <= 1) return { stm: FARE_STM_1H, cash: FARE_CASH_1H, exact: true };
  // 2+ transbordos: como mínimo 1 boleto; puede ser más si excede 60 min.
  return { stm: FARE_STM_1H, cash: FARE_CASH_1H, exact: false };
}

/** Texto corto para la UI: "$52 con tarjeta" o "desde $52". */
export function fareLabel(numTransfers: number): string {
  const f = estimateFare(numTransfers);
  return f.exact ? `$${f.stm} con tarjeta` : `desde $${f.stm}`;
}
