"use client";

import type { ReactNode } from "react";

/**
 * Estado vacío / de error con voz de marca (blindaje de API, idea Gemini #5).
 *
 * Distinguimos honestamente:
 *  - API caída → cara amigable + reintentar ("los servidores del STM están durmiendo").
 *  - Sin servicios reales → mensaje neutral.
 * Diferencial: velocidad + honestidad, sin fingir datos que no tenemos.
 */
export default function EmptyState({
  emoji,
  icon,
  title,
  sub,
  onRetry,
  retryLabel = "Probar de nuevo",
}: {
  emoji?: string;
  icon?: ReactNode;
  title: string;
  sub?: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <div className="empty-state">
      <div className="empty-state-ico" aria-hidden>
        {emoji ? <span style={{ fontSize: 26 }}>{emoji}</span> : icon}
      </div>
      <div style={{ textAlign: "center" }}>
        <p className="empty-state-title">{title}</p>
        {sub && <p className="empty-state-sub">{sub}</p>}
      </div>
      {onRetry && (
        <button className="empty-state-retry" onClick={onRetry}>
          {retryLabel}
        </button>
      )}
    </div>
  );
}
