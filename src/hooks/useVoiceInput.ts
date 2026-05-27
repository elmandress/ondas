"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export type VoiceState = "idle" | "listening" | "processing" | "error";

// Web Speech API no está en todos los lib.dom.d.ts — declaramos lo mínimo necesario.
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionAlternative {
  transcript: string;
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}
interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onstart: (() => void) | null;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
interface SpeechRecognitionConstructor {
  new(): SpeechRecognitionInstance;
}

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

interface UseVoiceInputOptions {
  onResult: (transcript: string) => void;
  onError?: (msg: string) => void;
  lang?: string;
}

/**
 * Hook para reconocimiento de voz usando Web Speech API.
 * - Gratuito, sin API key, funciona en Chrome/Android y Edge.
 * - En iOS Safari disponible desde iOS 14.5 pero requiere interacción previa.
 * - Si el browser no lo soporta, `supported` es false y el botón no se muestra.
 */
export function useVoiceInput({ onResult, onError, lang = "es-UY" }: UseVoiceInputOptions) {
  const [state, setState] = useState<VoiceState>("idle");
  const recRef = useRef<SpeechRecognitionInstance | null>(null);

  const supported = !!getSpeechRecognition();

  const stop = useCallback(() => {
    recRef.current?.stop();
    recRef.current = null;
    setState("idle");
  }, []);

  const start = useCallback(() => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) return;
    stop();

    const rec = new SpeechRecognition();
    rec.lang = lang;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.continuous = false;

    rec.onstart = () => setState("listening");

    rec.onresult = (event: SpeechRecognitionEvent) => {
      setState("processing");
      const transcript = event.results[0]?.[0]?.transcript?.trim() ?? "";
      if (transcript) onResult(transcript);
      else onError?.("No se entendió nada, intentá de nuevo");
      setState("idle");
    };

    rec.onerror = (event: SpeechRecognitionErrorEvent) => {
      const msg =
        event.error === "not-allowed" ? "Permiso de micrófono denegado" :
        event.error === "no-speech" ? "No se detectó voz" :
        "Error de reconocimiento de voz";
      onError?.(msg);
      setState("error");
      setTimeout(() => setState("idle"), 2000);
    };

    rec.onend = () => setState((s) => s === "processing" ? s : "idle");

    recRef.current = rec;
    rec.start();
  }, [lang, onResult, onError, stop]);

  // Limpiar al desmontar
  useEffect(() => () => { recRef.current?.stop(); }, []);

  return { state, supported, start, stop };
}
