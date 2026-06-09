"use client";

/**
 * Tamaño de texto accesible. Para que la app la pueda usar cualquiera — sobre todo
 * adultos mayores, el segmento que TODAS las apps de transporte abandonan (ver
 * docs/AUDITORIA-MAESTRA.md). Aplica una clase al <html> que escala el
 * font-size base; el resto del CSS usa rem/em y escala solo.
 *
 * Persistente en localStorage. Sin cuenta.
 */
import { useSyncExternalStore } from "react";

export type TextSize = "normal" | "grande";
const KEY = "cuando_text_size";

export function getTextSize(): TextSize {
  if (typeof window === "undefined") return "normal";
  try {
    const v = localStorage.getItem(KEY);
    return v === "grande" ? "grande" : "normal";
  } catch { return "normal"; }
}

export function applyTextSize(size: TextSize) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("text-grande", size === "grande");
}

const listeners = new Set<() => void>();
export function setTextSize(size: TextSize) {
  try { localStorage.setItem(KEY, size); } catch {}
  applyTextSize(size);
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) { listeners.add(cb); return () => { listeners.delete(cb); }; }

export function useTextSize(): TextSize {
  return useSyncExternalStore(subscribe, getTextSize, () => "normal");
}
