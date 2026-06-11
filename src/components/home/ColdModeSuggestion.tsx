"use client";

/**
 * Modo frío (proactivo): cuando la espera acá es larga, muestra de frente las
 * alternativas alcanzables a pasos con su ETA EN VIVO — "a 120 m el 405 llega en ~6 min".
 * Evolución proactiva de "A pasos también pasan" (que solo lista líneas, sin cuándo).
 * Datos y reglas en hooks/useColdAlternatives + lib/cold-mode.
 */
import { useEffect, useRef } from "react";
import type { ColdSuggestion } from "@/lib/cold-mode";
import { formatEta } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { Icons } from "@/components/brand/Icons";
import LineBadge from "@/components/ui/LineBadge";

export default function ColdModeSuggestion({ suggestions }: { suggestions: ColdSuggestion[] }) {
  // Analytics una sola vez por apertura del sheet (no por cada refresh de 60 s).
  const trackedRef = useRef(false);
  useEffect(() => {
    if (suggestions.length > 0 && !trackedRef.current) {
      trackedRef.current = true;
      track("cold_mode_shown", { count: suggestions.length });
    }
  }, [suggestions]);

  if (suggestions.length === 0) return null;

  return (
    <div className="cold-mode" role="status">
      <div className="cm-head"><Icons.Walk size={14} /> Espera larga — a pasos sale antes</div>
      {suggestions.map((s) => (
        <div key={`${s.stopId}-${s.line}`} className="cm-row">
          <LineBadge num={s.line} size="sm" />
          <div className="cm-info">
            <div className="cm-dest">{s.destination || `Línea ${s.line}`}</div>
            <div className="cm-meta">{s.stopName.split(" – ")[0]} · {s.distM} m ({s.walkMin} min a pie)</div>
          </div>
          <div className="cm-eta">{formatEta(s.etaMin, s.isScheduled)}</div>
        </div>
      ))}
    </div>
  );
}
