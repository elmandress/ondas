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
 * Tarifa suburbana/metropolitana según la DISTANCIA del viaje en bus (km).
 *
 * CLAVE (gap corregido R71): antes `estimateFare(suburban)` devolvía SIEMPRE `dentro_mvd`
 * ($86), ignorando la distancia → un viaje a Canelones de 50 km (real $153) se mostraba "$86".
 * La distancia ya estaba disponible (la suma de los tramos en bus); no se usaba.
 *
 * En la app, "suburbano" = la ruta usa una línea METRO (variant "M-"), y eso IMPLICA que el
 * viaje SALE de Montevideo: el planner bloquea las metro en viajes intra-MVD
 * (route-planner-gtfs `allowVariant`). Por eso el piso real es `hasta_32km` ($107), no
 * `dentro_mvd` ($86) — ese tramo es para un servicio suburbano DENTRO de MVD, que la app no
 * rutea (los viajes intra-MVD van por líneas urbanas → tarifa urbana, no esta función).
 */
export function suburbanFareForKm(km?: number): number {
  if (!Number.isFinite(km)) return SUBURBAN_FARES.hasta_32km; // distancia desconocida → tramo base de salir
  const k = km as number;
  if (k <= 32) return SUBURBAN_FARES.hasta_32km;
  if (k <= 40) return SUBURBAN_FARES.hasta_40km;
  return SUBURBAN_FARES.hasta_60km; // ≤60 y más allá (no hay tramo mayor)
}

/**
 * Estima el costo de una ruta. Urbano: boleto de 1 hora (1 transbordo). Suburbano: tramo por
 * distancia (`km` = total en bus). Sin `km` cae al tramo base suburbano (honesto: nunca el
 * mínimo intra-MVD, porque un viaje suburbano sale de MVD — ver suburbanFareForKm).
 */
export function estimateFare(numTransfers: number, suburban = false, km?: number): FareEstimate {
  if (suburban) {
    const price = suburbanFareForKm(km);
    return { stm: price, cash: price, exact: false, suburban: true };
  }
  const exact = numTransfers <= 1;
  return { stm: URBAN_FARES.hora_stm, cash: URBAN_FARES.hora_efectivo, exact, suburban: false };
}

/** Texto corto para el resumen de la tarjeta: "~$64 efectivo" / "~desde $64" / "~$86 suburbano".
 *  El "~" deja claro que es estimado. Mostramos el EFECTIVO primero (es lo que paga la
 *  mayoría sin tarjeta STM; con tarjeta sale más barato → buena sorpresa, no mala). */
export function fareLabel(numTransfers: number, suburban = false, km?: number): string {
  const f = estimateFare(numTransfers, suburban, km);
  if (f.suburban) return `~$${f.cash} suburbano`;
  return f.exact ? `~$${f.cash} efectivo` : `~desde $${f.cash} efectivo`;
}

/**
 * Cuántos boletos comunes (con tarjeta STM) rinde un saldo dado. Para la pantalla de
 * Saldo: el usuario teclea su saldo y le decimos cuántos viajes le quedan. Devuelve
 * null si el saldo no es un número válido y positivo (no asumir 0 viajes ante basura).
 */
export function boletosFromSaldo(saldo: number): number | null {
  if (!Number.isFinite(saldo) || saldo < 0) return null;
  return Math.floor(saldo / URBAN_FARES.hora_stm);
}

/** Detalle completo para la ruta expandida: efectivo primero + tarjeta + vigencia. */
export function fareDetail(numTransfers: number, suburban = false, km?: number): string {
  const f = estimateFare(numTransfers, suburban, km);
  if (f.suburban) {
    const tramo = !Number.isFinite(km) ? "varía por distancia"
      : (km as number) <= 32 ? "hasta 32 km"
      : (km as number) <= 40 ? "hasta 40 km" : "hasta 60 km";
    return `Estimado ~$${f.cash} (suburbano, ${tramo}) · valores vigentes a ${FARE_VIGENCIA}`;
  }
  const base = f.exact ? `$${f.cash} efectivo / $${f.stm} con tarjeta` : `desde $${f.cash} efectivo`;
  return `${base} · estimado según tarifas vigentes a ${FARE_VIGENCIA}`;
}
