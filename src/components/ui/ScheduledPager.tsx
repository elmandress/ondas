/**
 * Pager de horarios PROGRAMADOS de una línea en una parada (idea estilo maprab).
 *
 * El usuario ya ve el próximo bus arriba (live o programado). Acá puede recorrer
 * con ‹ › los siguientes horarios programados de ESA línea: "y el de después,
 * ¿a qué hora?". Honesto: rotulado "horario" — son programados, no posiciones GPS.
 *
 * Lazy: no pide nada hasta que se monta (el padre lo monta al abrir).
 */
"use client";

import { useState } from "react";
import { useLineSchedule } from "@/hooks/useLineSchedule";
import { Icons } from "@/components/brand/Icons";

function relLabel(minutesFromNow: number): string {
  if (minutesFromNow <= 0) return "ahora";
  if (minutesFromNow === 1) return "en 1 min";
  if (minutesFromNow < 60) return `en ${minutesFromNow} min`;
  const h = Math.floor(minutesFromNow / 60);
  const m = minutesFromNow % 60;
  return m === 0 ? `en ${h} h` : `en ${h} h ${m} min`;
}

export default function ScheduledPager({
  stopId,
  lineName,
}: {
  stopId: string;
  lineName: string;
}) {
  const { times, loading } = useLineSchedule(stopId, lineName, true);
  const [idx, setIdx] = useState(0);

  if (loading) {
    return (
      <div className="sched-pager">
        <span className="sp-muted">Buscando horarios programados…</span>
      </div>
    );
  }

  if (!times.length) {
    return (
      <div className="sched-pager">
        <span className="sp-muted">Sin más horarios programados hoy</span>
      </div>
    );
  }

  const safe = Math.min(idx, times.length - 1);
  const t = times[safe];
  const atStart = safe <= 0;
  const atEnd = safe >= times.length - 1;

  return (
    <div className="sched-pager">
      <button
        className="sp-nav"
        onClick={(e) => { e.stopPropagation(); setIdx((i) => Math.max(0, i - 1)); }}
        disabled={atStart}
        aria-label="Horario anterior"
      >
        <span style={{ display: "grid", transform: "rotate(180deg)" }}><Icons.Chevron size={16} /></span>
      </button>

      <div className="sp-body">
        <Icons.Clock size={14} />
        <span className="sp-time tnum">{t.horaStr}</span>
        <span className="sp-rel">· {relLabel(t.minutesFromNow)}</span>
        <span className="sp-tag">horario</span>
      </div>

      <span className="sp-count tnum">{safe + 1}/{times.length}</span>

      <button
        className="sp-nav"
        onClick={(e) => { e.stopPropagation(); setIdx((i) => Math.min(times.length - 1, i + 1)); }}
        disabled={atEnd}
        aria-label="Horario siguiente"
      >
        <Icons.Chevron size={16} />
      </button>
    </div>
  );
}
