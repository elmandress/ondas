"use client";

/**
 * theme.ts — DARK-ONLY desde R67 (identidad "señalética" nocturna).
 * `resolveTheme` siempre devuelve "dark"; el CSS `[data-theme="light"]` ya se eliminó
 * de globals.css (R69). El tema lo fija el pre-paint de layout.tsx (`data-theme="dark"`),
 * así que este módulo no lo usa la app — se mantiene `resolveTheme` (tested) y la firma
 * de los helpers por si alguna vez vuelve un tema claro (se reintroduce el override
 * `[data-theme="light"]` y se hace que `resolveTheme` respete el modo de nuevo).
 */

import { useSyncExternalStore } from "react";

export type ThemeMode = "auto" | "light" | "dark";
export type Theme = "dark" | "light";
const KEY = "cuando_theme";
const listeners = new Set<() => void>();

export function getMode(): ThemeMode {
  if (typeof window === "undefined") return "auto";
  const v = localStorage.getItem(KEY);
  return v === "light" || v === "dark" || v === "auto" ? v : "auto";
}

/** Resuelve el tema concreto. R67: decisión DARK-ONLY (identidad "señalética"
 *  nocturna — farol de sodio sobre asfalto). El tema light queda deprecado: siempre
 *  devolvemos "dark"; el selector de Apariencia se quitó de Ajustes y el CSS de
 *  [data-theme="light"] se eliminó (R69). */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- dark-only: el modo se ignora a propósito (se mantiene la firma para callers/tests)
export function resolveTheme(_mode: ThemeMode = getMode()): Theme {
  return "dark";
}

export function getTheme(): Theme {
  return resolveTheme();
}

export function applyTheme(t: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", t);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", "#0E1116"); // R67: dark-only — asfalto
}

export function setMode(mode: ThemeMode) {
  if (typeof window !== "undefined") {
    try { localStorage.setItem(KEY, mode); } catch { /* cuota llena / modo privado: igual aplicamos el tema en memoria */ }
  }
  applyTheme(resolveTheme(mode));
  listeners.forEach((fn) => fn());
}

/** Toggle rápido (sol/luna): fija un modo explícito opuesto al actual. */
export function toggleTheme() {
  setMode(getTheme() === "dark" ? "light" : "dark");
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Hook reactivo del tema concreto (dark|light). */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, getTheme, () => "dark");
}

/** Hook reactivo del MODO (auto|light|dark) — para el selector en Ajustes. */
export function useThemeMode(): ThemeMode {
  return useSyncExternalStore(subscribe, getMode, () => "auto");
}
