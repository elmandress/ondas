"use client";

import { usePeakStatus } from "@/hooks/usePeakStatus";
import { Icons } from "@/components/brand/Icons";

/**
 * Aviso sobrio de HORA PICO (Montevideo). Solo aparece dentro de la franja
 * (días hábiles 7–9 / 17–20). No alarma: informa que el horario PROGRAMADO puede
 * quedar corto y los buses ir más llenos. La metodología se explica en Ajustes.
 *
 * `compact`: solo el título (sin la línea de detalle), para espacios chicos.
 */
export default function PeakHint({ compact = false }: { compact?: boolean }) {
  const peak = usePeakStatus();
  if (!peak.isPeak) return null;

  return (
    <div className="peak-hint" role="status" aria-live="polite">
      <span className="peak-hint-ico" aria-hidden>
        <Icons.Clock size={15} />
      </span>
      <div className="peak-hint-body">
        <p className="peak-hint-title">{peak.label}</p>
        {!compact && peak.hint && <p className="peak-hint-sub">{peak.hint}</p>}
      </div>
    </div>
  );
}
