"use client";

import { useEffect, useRef, useState } from "react";
import { reportOccupancy, getRecentOccupancy, recentlyReported, occupancyLabel, type OccupancyLevel, type OccupancySummary } from "@/lib/occupancy";
import { isSupabaseEnabled } from "@/lib/supabase/client";
import { haptic } from "@/lib/haptics";
import LineBadge from "@/components/ui/LineBadge";

/**
 * Crowdsourcing de ocupación en la parada: muestra el agregado reciente ("venía lleno")
 * y deja reportar en 1 toque, sin molestar. Solo aparece si Supabase está configurado
 * (degradable). Discreto: una tarjeta al final de las llegadas.
 */
// R59: dots CSS en vez de emojis 🟢🟡🔴 — un solo sistema visual (los emojis
// compiten con los íconos vectoriales y cada OS los dibuja distinto).
const LEVELS: { v: OccupancyLevel; color: string; label: string }[] = [
  { v: 1, color: "var(--live)", label: "Vacío" },
  { v: 2, color: "var(--accent)", label: "Normal" },
  { v: 3, color: "var(--warn)", label: "Lleno" },
];

export default function OccupancySection({ stopId, lines }: { stopId: string; lines: string[] }) {
  const [summary, setSummary] = useState<Record<string, OccupancySummary>>({});
  const [done, setDone] = useState<Record<string, OccupancyLevel>>({});
  // R58: colapsada por defecto — 4 líneas × 3 botones ocupaban media pantalla SIEMPRE,
  // para una acción que la mayoría no hace en cada visita. Si hay reportes recientes
  // (info útil para el que espera), se abre sola para mostrarlos.
  const [expanded, setExpanded] = useState(false);
  const top = lines.slice(0, 4);
  const activeRef = useRef(true);

  useEffect(() => {
    activeRef.current = true;
    if (!isSupabaseEnabled() || top.length === 0) return;
    getRecentOccupancy(stopId, top).then((s) => {
      if (!activeRef.current) return;
      setSummary(s);
      if (Object.keys(s).length > 0) setExpanded(true); // hay datos para ver → mostrar
    });
    // marcar las ya reportadas hace poco (no repreguntar)
    const pre: Record<string, OccupancyLevel> = {};
    for (const l of top) if (recentlyReported(l, stopId)) pre[l] = 0 as OccupancyLevel;
    setDone(pre);
    return () => { activeRef.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopId, top.join(",")]);

  if (!isSupabaseEnabled() || top.length === 0) return null;

  const handleReport = async (line: string, level: OccupancyLevel) => {
    haptic(12);
    setDone((d) => ({ ...d, [line]: level })); // feedback inmediato
    const ok = await reportOccupancy(line, stopId, level);
    if (!activeRef.current) return;
    if (ok) {
      getRecentOccupancy(stopId, top).then((s) => { if (activeRef.current) setSummary(s); });
    } else {
      // No se guardó (sin backend/tabla) → revertir: no agradecemos algo que no pasó.
      setDone((d) => { const n = { ...d }; delete n[line]; return n; });
    }
  };

  // Texto del agregado, HONESTO: con 1 solo reporte no afirmamos "venía lleno" como
  // verdad (sería engañoso) — decimos "1 persona dice". El agregado firme es con ≥2.
  const recentText = (s: OccupancySummary): string => {
    const { text, emoji } = occupancyLabel(s.level);
    const ago = s.minutesAgo <= 0 ? "recién" : `hace ${s.minutesAgo} min`;
    return s.count === 1 ? `${emoji} 1 persona: ${text} · ${ago}` : `${emoji} ${text} · ${s.count} dicen · ${ago}`;
  };

  if (!expanded) {
    return (
      <div className="occ-section collapsed">
        <button className="occ-toggle" onClick={() => { haptic(6); setExpanded(true); }} aria-expanded={false}>
          ¿Te subiste recién? <span>contá cómo venía y ayudás a otros</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m9 18 6-6-6-6"/></svg>
        </button>
      </div>
    );
  }

  return (
    <div className="occ-section">
      {/* Apunta al que SE SUBIÓ (sabe la ocupación), no al que espera (no la sabe). */}
      <div className="occ-head">¿Te subiste recién? <span>contá cómo venía y ayudás a otros</span></div>
      <div className="occ-rows">
        {top.map((line) => {
          const s = summary[line];
          const reported = line in done;
          return (
            <div key={line} className="occ-row">
              <LineBadge num={line} size="sm" />
              {reported ? (
                <span className="occ-thanks">¡Gracias! {done[line] ? occupancyLabel(done[line]).emoji : ""}</span>
              ) : (
                <div className="occ-btns">
                  {LEVELS.map((lv) => (
                    <button key={lv.v} className="occ-btn" onClick={() => handleReport(line, lv.v)} aria-label={`${line} ${lv.label}`}>
                      <span aria-hidden style={{ width: 9, height: 9, borderRadius: 999, background: lv.color, display: "inline-block", flexShrink: 0 }} />{lv.label}
                    </button>
                  ))}
                </div>
              )}
              {s && !reported && (
                <span className="occ-recent" title={`${s.count} reporte${s.count > 1 ? "s" : ""} en los últimos 45 min`}>
                  {recentText(s)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
