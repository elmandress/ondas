"use client";

/**
 * theme.ts — Tema con 3 modos: Auto / Claro / Oscuro.
 *  - "auto" (default): DE NOCHE oscuro (descanso visual), de día según el dispositivo.
 *    El oscuro sigue siendo la base de marca; auto solo lo refuerza de noche.
 *  - "light" / "dark": fijo, elegido por el usuario (gana siempre).
 * El diseño ya es 80% tokens (var(--...)), así que el tema se define overrideando
 * esos tokens bajo [data-theme="light"] en globals.css; acá solo resolvemos y aplicamos.
 */

import { useSyncExternalStore } from "react";

export type ThemeMode = "auto" | "light" | "dark";
export type Theme = "dark" | "light";
const KEY = "cuando_theme";
const listeners = new Set<() => void>();

function systemPrefersLight(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-color-scheme: light)").matches;
}

/** ¿Es de noche en Montevideo? (19:00–07:00) → modo oscuro automático. */
export function isNightMVD(date: Date = new Date()): boolean {
  const h = parseInt(
    new Intl.DateTimeFormat("en-GB", { timeZone: "America/Montevideo", hour: "2-digit", hour12: false }).format(date),
    10,
  );
  return Number.isFinite(h) ? h >= 19 || h < 7 : true;
}

export function getMode(): ThemeMode {
  if (typeof window === "undefined") return "auto";
  const v = localStorage.getItem(KEY);
  return v === "light" || v === "dark" || v === "auto" ? v : "auto";
}

/** Resuelve el tema concreto (dark|light) a partir del modo. */
export function resolveTheme(mode: ThemeMode = getMode()): Theme {
  if (mode === "light") return "light";
  if (mode === "dark") return "dark";
  // auto: de noche oscuro; de día seguí al dispositivo (si no, oscuro = marca).
  if (isNightMVD()) return "dark";
  return systemPrefersLight() ? "light" : "dark";
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
  if (typeof window !== "undefined") localStorage.setItem(KEY, mode);
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
