"use client";

import { useEffect, useState } from "react";

/**
 * Banner global de "sin conexión". Aparece SOLO cuando el navegador pierde la red
 * (navigator.onLine) y desaparece al volver. Honestidad: el usuario entiende por qué
 * no hay datos en vivo, en vez de quedarse mirando spinners mudos (queja universal).
 *
 * Discreto: una barra fina arriba, no un modal. La app sigue usable con lo cacheado
 * (paradas, recorridos) gracias al service worker.
 */
export default function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    // Estado inicial + listeners. navigator.onLine no es 100% confiable pero alcanza
    // para el aviso (los fetch reales igual tienen su propio fallback).
    const update = () => setOffline(typeof navigator !== "undefined" && !navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      style={{
        position: "fixed",
        top: "env(safe-area-inset-top, 0px)",
        left: 0,
        right: 0,
        zIndex: 2000,
        background: "var(--warn, #f0564b)",
        color: "#fff",
        font: "600 12px/1 var(--ff)",
        textAlign: "center",
        padding: "7px 12px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: 999, background: "#fff", opacity: 0.85 }} />
      Sin conexión — mostramos lo último que guardamos
    </div>
  );
}
