"use client";

import { useEffect, useState } from "react";
import { track } from "@/lib/analytics";

/**
 * Registra el service worker (PWA installable) y avisa cuando hay una NUEVA VERSIÓN.
 *
 * Blindaje de deploy: aunque el SW ya sirve el HTML por red (no rompe), si el usuario
 * tiene la pestaña abierta hace rato puede estar con JS viejo. Cuando se instala un SW
 * nuevo, mostramos un toast discreto "Hay una nueva versión · Actualizar" → recarga y
 * queda al día. No recargamos solos (sería interrumpir en medio del uso).
 */
export default function PwaRegister() {
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    // Solo en producción para no interferir con HMR de Next dev
    if (process.env.NODE_ENV !== "production") return;

    let reg: ServiceWorkerRegistration | null = null;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((r) => {
        reg = r;
        // Un SW nuevo empieza a instalarse → cuando termine, si YA había uno controlando
        // la página, es una ACTUALIZACIÓN (no la primera instalación) → avisamos.
        r.addEventListener("updatefound", () => {
          const nw = r.installing;
          if (!nw) return;
          nw.addEventListener("statechange", () => {
            if (nw.state === "installed" && navigator.serviceWorker.controller) {
              setUpdateReady(true);
              track("pwa_update_available");
            }
          });
        });
      })
      .catch((err) => console.warn("[PWA] SW registration failed:", err));

    // Métrica de growth: cuánta gente INSTALA la app (lealtad/retención). Anónimo.
    const onInstalled = () => track("pwa_installed");
    window.addEventListener("appinstalled", onInstalled);
    // Chequear updates al volver a la pestaña (deploy mientras estaba en background).
    const onVisible = () => { if (!document.hidden && reg) reg.update().catch(() => {}); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("appinstalled", onInstalled);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (!updateReady) return null;

  return (
    <div className="sw-update" role="status">
      <span>Hay una nueva versión de Cuándo</span>
      <button onClick={() => { track("pwa_update_apply"); window.location.reload(); }}>Actualizar</button>
    </div>
  );
}
