"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Overlay de "Escuchando…" para búsqueda por voz.
 * Robusto contra el ghost-click: el tap que abre el overlay NO lo cierra
 * (ignoramos clicks del backdrop durante los primeros 600ms). Sólo cierra con
 * el botón Cancelar o un click posterior fuera del core.
 */
export default function VoiceOverlay({
  open,
  onCancel,
  // Honestidad: NO es un asistente que entiende "llevame a...". Reconoce un lugar,
  // parada o calle y lo escribe en el buscador. El ejemplo deja claro qué decir.
  hint = "Decí un lugar, parada o dirección — ej. “Pocitos” o “Avenida Italia”",
}: {
  open: boolean;
  onCancel: () => void;
  hint?: string;
}) {
  const [armed, setArmed] = useState(false);
  const openedAt = useRef(0);

  useEffect(() => {
    if (!open) { setArmed(false); return; }
    openedAt.current = Date.now();
    const id = setTimeout(() => setArmed(true), 600);
    return () => clearTimeout(id);
  }, [open]);

  if (!open) return null;

  const guardedCancel = () => {
    if (Date.now() - openedAt.current < 600) return; // ignora el tap de apertura
    onCancel();
  };

  return (
    <div className="voice-overlay" onClick={guardedCancel}>
      <div className="core" onClick={(e) => e.stopPropagation()}>
        <div className="voice-wave"><span /><span /><span /><span /><span /><span /></div>
        <div style={{ font: "700 22px/1 var(--ff)", color: "var(--text)" }}>Escuchando…</div>
        <div style={{ font: "var(--font-body)", color: "var(--text-2)", textAlign: "center", maxWidth: 280 }}>{hint}</div>
        <button
          onClick={(e) => { e.stopPropagation(); onCancel(); }}
          disabled={!armed}
          style={{ marginTop: 12, padding: "10px 20px", borderRadius: 100, background: "var(--surface)", color: "var(--text-2)", font: "var(--font-small)", opacity: armed ? 1 : 0.5 }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
