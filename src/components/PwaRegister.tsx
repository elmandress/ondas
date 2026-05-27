"use client";

import { useEffect } from "react";

/**
 * Registra el service worker para que Ondas sea PWA installable.
 * Cumple criterios de Chrome (Android) y Safari (iOS).
 */
export default function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    // Solo en producción para no interferir con HMR de Next dev
    if (process.env.NODE_ENV !== "production") return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch((err) => console.warn("[PWA] SW registration failed:", err));
  }, []);

  return null;
}
