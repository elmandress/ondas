/**
 * Impacto del viaje: CO₂ ahorrado (vs. ir en auto) y calorías al caminar.
 * Datos REALES con fuente, presentados como estimación (honestidad #1).
 *
 * Fuentes:
 *  - CO₂: auto promedio ~249 g/km, transporte público urbano ~63 g/km (EPA / DEFRA
 *    2022, vía Our World in Data). Ahorro ≈ 186 g por km que hacés en bus en vez de auto.
 *  - Calorías: caminar a paso moderado quema ~4 cal/min (Healthline; varía por peso).
 *
 * Es orientativo y motivador (como Citymapper). No afirmamos exactitud por persona.
 */

const CO2_CAR_PER_KM = 249;   // g CO₂/km en auto privado promedio
const CO2_BUS_PER_KM = 63;    // g CO₂/km en transporte público urbano
const CO2_SAVED_PER_KM = CO2_CAR_PER_KM - CO2_BUS_PER_KM; // ≈ 186 g/km
const CAL_PER_WALK_MIN = 4;   // calorías por minuto caminando (paso moderado)

export interface TripImpact {
  co2SavedG: number;     // gramos de CO₂ ahorrados vs auto
  walkCalories: number;  // calorías estimadas de los tramos a pie
}

/**
 * Calcula el impacto de un viaje a partir de los metros en bus y los minutos a pie.
 * @param busDistanceM  metros recorridos en bus (suma de los bus legs)
 * @param walkMinutes   minutos totales a pie
 */
export function tripImpact(busDistanceM: number, walkMinutes: number): TripImpact {
  const busKm = Math.max(0, busDistanceM) / 1000;
  return {
    co2SavedG: Math.round(busKm * CO2_SAVED_PER_KM),
    walkCalories: Math.round(Math.max(0, walkMinutes) * CAL_PER_WALK_MIN),
  };
}

/** Texto corto para la UI, ej: "Ahorrás ~340 g de CO₂ · ~28 cal caminando". */
export function tripImpactLabel(busDistanceM: number, walkMinutes: number): string | null {
  const { co2SavedG, walkCalories } = tripImpact(busDistanceM, walkMinutes);
  const parts: string[] = [];
  if (co2SavedG >= 20) {
    // Mostrar en kg si es grande, para que se lea mejor.
    parts.push(co2SavedG >= 1000 ? `Ahorrás ~${(co2SavedG / 1000).toFixed(1)} kg de CO₂ vs auto` : `Ahorrás ~${co2SavedG} g de CO₂ vs auto`);
  }
  if (walkCalories >= 10) parts.push(`~${walkCalories} cal caminando`);
  return parts.length ? parts.join(" · ") : null;
}
