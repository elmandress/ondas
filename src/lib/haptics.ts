/**
 * Haptic feedback sutil (navigator.vibrate). Hace que las acciones clave se sientan
 * "premium" sin ruido visual — patrón de Apple/Google Maps. Degrada en silencio en
 * navegadores/desktop sin soporte (Safari iOS no soporta vibrate en web; no pasa nada).
 *
 * Uso parco: solo en confirmaciones importantes (seguir bus, "salí ahora"), nunca en
 * cada toque (sería molesto y gasta batería).
 */
"use client";

export function haptic(pattern: number | number[] = 12): void {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    /* sin soporte — degradar en silencio */
  }
}
