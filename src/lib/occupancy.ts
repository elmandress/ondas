/**
 * Heurística de ocupación basada en hora del día y día de semana.
 * No hay datos reales de ocupación — usamos patrones conocidos de Montevideo.
 *
 * Feedback de Guille: "estimación de horas pico para estimar qué tan lleno viene"
 */

export function estimateOccupancy(
  date?: Date
): "low" | "medium" | "high" {
  const now = date || new Date();
  const hour = now.getHours();
  const day = now.getDay(); // 0=dom, 6=sab

  // Domingos: siempre baja ocupación
  if (day === 0) return "low";

  // Sábados: media en hora pico matutina, baja el resto
  if (day === 6) {
    if (hour >= 9 && hour <= 13) return "medium";
    return "low";
  }

  // Lun-Vie: horas pico conocidas de Montevideo
  // Mañana: 7:00-9:30 = alta, 9:30-10:00 = media
  if (hour >= 7 && hour < 9) return "high";
  if (hour === 9) return "medium";

  // Mediodía: 12:00-14:00 = media (almuerzo/liceos)
  if (hour >= 12 && hour <= 13) return "medium";

  // Tarde: 17:00-19:30 = alta, 16:00-17:00 = media
  if (hour >= 17 && hour < 20) return "high";
  if (hour === 16) return "medium";

  // Resto: baja
  return "low";
}

/** Label amigable para la ocupación */
export function occupancyLabel(level: "low" | "medium" | "high"): string {
  switch (level) {
    case "high": return "Muy lleno";
    case "medium": return "Ocupado";
    case "low": return "Tranquilo";
  }
}
