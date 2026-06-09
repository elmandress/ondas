"use client";

/**
 * theme.ts — Tema con 3 modos: Auto / Claro / Oscuro.
 *  - "auto" (default): siempre oscuro — identidad dark-first de marca.
 *  - "light" / "dark": fijo, elegido explícitamente por el usuario.
 * El diseño es 100% tokens (var(--...)); el tema se define overrideando esos tokens
 * bajo [data-theme="light"] en globals.css.
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

/** Resuelve el tema concreto (dark|light) a partir del modo. */
export function resolveTheme(mode: ThemeMode = getMode()): Theme {
  if (mode === "light") return "light";
  if (mode === "dark") return "dark";
  // auto = siempre dark (identidad de marca dark-first).
  // El usuario que quiere light lo elige explícitamente.
  return "dark";
}

export function getTheme(): Theme {
  return resolveTheme();
}

export function applyTheme(t: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", t);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", t === "light" ? "#f4f6fa" : "#070b14");
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
