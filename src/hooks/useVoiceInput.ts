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
  const netRetriedRef = useRef(false); // un reintento silencioso ante error "network"
  // Mantenemos onResult/onError en refs para que start/stop sean estables y no se
  // recreen en cada render (evita reinicios raros del reconocimiento).
  const onResultRef = useRef(onResult);
  const onErrorRef = useRef(onError);
  onResultRef.current = onResult;
  onErrorRef.current = onError;
  // Bandera: ya entregamos un resultado (no reportar el "end" como error).
  const gotResultRef = useRef(false);

  // Requiere contexto seguro (HTTPS o localhost). En http://IP-de-LAN el navegador
  // bloquea Web Speech → por eso "no anda" al probar desde el celular por IP.
  const secure = typeof window !== "undefined" && (window.isSecureContext ?? true);
  const supported = !!getSpeechRecognition() && secure;

  const stop = useCallback(() => {
    const rec = recRef.current;
    recRef.current = null;
    try { rec?.stop(); } catch {}
    setState("idle");
  }, []);

  const start = useCallback(() => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      onErrorRef.current?.("Tu navegador no soporta búsqueda por voz");
      return;
    }
    if (!secure) {
      onErrorRef.current?.("La voz necesita HTTPS (o abrir en localhost)");
      return;
    }
    // Cerrar instancia previa sin disparar onerror/onend de la vieja.
    const prev = recRef.current;
    recRef.current = null;
    if (prev) { prev.onerror = null; prev.onend = null; prev.onresult = null; try { prev.stop(); } catch {} }

    gotResultRef.current = false;
    netRetriedRef.current = false;
    const rec = new SpeechRecognition();
    rec.lang = lang;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.continuous = false;

    rec.onstart = () => setState("listening");

    rec.onresult = (event: SpeechRecognitionEvent) => {
      gotResultRef.current = true;
      const transcript = event.results[0]?.[0]?.transcript?.trim() ?? "";
      setState("idle");
      if (transcript) onResultRef.current(transcript);
      else onErrorRef.current?.("No se entendió nada, intentá de nuevo");
    };

    rec.onerror = (event: SpeechRecognitionErrorEvent) => {
      // "aborted" / "no-speech" son transitorios y comunes; no los gritamos como error duro.
      if (event.error === "aborted") { setState("idle"); return; }
      // "network": Chrome procesa la voz en SUS servidores; este error es del servicio
      // del navegador (frecuente en localhost), NO de la conexión del usuario. Reintentamos
      // UNA vez en silencio antes de avisar (suele ser transitorio).
      if (event.error === "network" && !netRetriedRef.current) {
        netRetriedRef.current = true;
        try { rec.stop(); } catch {}
        setTimeout(() => { try { rec.start(); } catch {} }, 250);
        return;
      }
      const msg =
        event.error === "not-allowed" || event.error === "service-not-allowed"
          ? "Permiso de micrófono denegado"
          : event.error === "no-speech" ? "No te escuché, probá de nuevo"
          : event.error === "audio-capture" ? "No se detectó micrófono"
          : event.error === "network" ? "La voz no respondió (la procesa tu navegador). Probá de nuevo o escribí 🙏"
          : `Error de voz (${event.error})`;
      onErrorRef.current?.(msg);
      setState("error");
      setTimeout(() => setState("idle"), 2200);
    };

    rec.onend = () => setState((s) => (s === "listening" ? "idle" : s));

    recRef.current = rec;
    // Feedback OPTIMISTA: abrimos el overlay "escuchando" al instante, sin esperar a
    // onstart. En algunos navegadores onstart tarda o no llega (el servicio de voz
    // del browser se cuelga) → sin esto el botón parecía "muerto" al tocarlo. Si algo
    // falla, onerror/onend vuelven el estado a idle.
    setState("listening");
    try {
      rec.start();
    } catch {
      // Algunos navegadores lanzan si ya hay un reconocimiento activo: lo reiniciamos.
      onErrorRef.current?.("No se pudo iniciar el micrófono, probá de nuevo");
      setState("idle");
    }
  }, [lang, secure]);

  // Limpiar al desmontar
  useEffect(() => () => { recRef.current?.stop(); }, []);

  return { state, supported, start, stop };
}
