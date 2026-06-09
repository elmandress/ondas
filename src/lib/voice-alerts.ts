"use client";

/**
 * Avisos por voz (Web Speech API — speechSynthesis). Sin backend, sin red.
 *
 * Para qué: accesibilidad (visión reducida) y manos libres — cuando seguís un bus
 * hacia tu parada, te avisa por voz "preparate" y "bajate ahora" sin que mires la
 * pantalla. Es opt-in (preferencia en localStorage): nadie quiere que la app hable
 * sin permiso. Degrada en silencio si el navegador no soporta TTS.
 */

const PREF_KEY = "cuando_voice_alerts";

export function isVoiceEnabled(): boolean {
  if (typeof window === "undefined") return false;
  if (!("speechSynthesis" in window)) return false;
  return localStorage.getItem(PREF_KEY) === "1";
}

export function setVoiceEnabled(on: boolean): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(PREF_KEY, on ? "1" : "0"); } catch { /* cuota/modo privado */ }
}

export function voiceSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

// Debounce module-level: coalesces rapid calls (3 en 200ms → solo el último)
// y da tiempo a cancel() para completar antes de que el nuevo utterance empiece.
let _speakTimer: ReturnType<typeof setTimeout> | null = null;

/** Dice una frase en español rioplatense si hay una voz es-* disponible. */
export function speak(text: string): void {
  if (!isVoiceEnabled()) return;
  if (_speakTimer) clearTimeout(_speakTimer);
  _speakTimer = setTimeout(() => {
    _speakTimer = null;
    try {
      const synth = window.speechSynthesis;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "es-UY";
      // Preferir una voz en español si el sistema la tiene (si no, la default).
      const esVoice = synth.getVoices().find((v) => v.lang.startsWith("es"));
      if (esVoice) u.voice = esVoice;
      u.rate = 1.02;
      synth.speak(u);
    } catch {
      /* TTS no disponible — degradamos en silencio */
    }
  }, 80); // 80 ms: coalesce + da tiempo a cancel() en browsers async
}
