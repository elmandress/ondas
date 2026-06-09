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
const LEVELS: { v: OccupancyLevel; emoji: string; label: string }[] = [
  { v: 1, emoji: "🟢", label: "Vacío" },
  { v: 2, emoji: "🟡", label: "Normal" },
  { v: 3, emoji: "🔴", label: "Lleno" },
];

export default function OccupancySection({ stopId, lines }: { stopId: string; lines: string[] }) {
  const [summary, setSummary] = useState<Record<string, OccupancySummary>>({});
  const [done, setDone] = useState<Record<string, OccupancyLevel>>({});
  const top = lines.slice(0, 4);
  const activeRef = useRef(true);

  useEffect(() => {
    activeRef.current = true;
    if (!isSupabaseEnabled() || top.length === 0) return;
    getRecentOccupancy(stopId, top).then((s) => { if (activeRef.current) setSummary(s); });
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
                      <span>{lv.emoji}</span>{lv.label}
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
