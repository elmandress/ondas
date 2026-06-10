"use client";

/**
 * Línea DISCRETA al final de las rutas: acceso a desvíos oficiales de la IM.
 * La IM no da API de alertas (verificado) → linkeamos su fuente oficial, sin
 * scraping frágil. No invasivo: solo un recordatorio honesto de "fijate si hay corte".
 */
import { useState } from "react";
import { SERVICE_ALERT_SOURCES } from "@/lib/service-alerts";
import { useServiceAlerts } from "@/hooks/useServiceAlerts";
import { Icons } from "@/components/brand/Icons";

export default function ServiceAlertsNote() {
  const [open, setOpen] = useState(false);
  const alerts = useServiceAlerts(); // feed REAL de la IM (notificacion/mensajes)

  // Si HAY avisos oficiales: mostrarlos prominentes (ámbar), no escondidos. Es info crítica.
  if (alerts.length > 0) {
    return (
      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
        {alerts.map((a) => (
          <div key={a.id} style={{ display: "flex", gap: 9, padding: "11px 13px", borderRadius: "var(--r-card)", background: "var(--accent-soft)", border: "1px solid var(--accent-border)" }}>
            <span style={{ color: "var(--accent)", flexShrink: 0, marginTop: 1, display: "inline-flex" }}><Icons.Warn size={16} /></span>
            <div style={{ minWidth: 0 }}>
              <p style={{ font: "700 13px/1.3 var(--ff)", color: "var(--text)" }}>{a.title}</p>
              {a.body && <p style={{ font: "500 12px/1.45 var(--ff)", color: "var(--text-2)", marginTop: 3 }}>{a.body}</p>}
              {a.url && <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ font: "600 11px/1 var(--ff)", color: "var(--accent)", marginTop: 5, display: "inline-block" }}>Más info ↗</a>}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Sin avisos: el desplegable discreto con el link a la fuente oficial (por si el feed
  // no tiene todo). Honesto: "no hay avisos cargados ahora".
  return (
    <div style={{ marginTop: 14 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ display: "flex", alignItems: "center", gap: 7, font: "500 12px/1.3 var(--ff)", color: "var(--text-3)", padding: "6px 2px" }}
      >
        <Icons.Warn size={14} />
        Sin avisos de desvíos ahora · ver fuente oficial
        <span style={{ fontSize: 10, transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }}>▾</span>
      </button>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
          {SERVICE_ALERT_SOURCES.map((s) => (
            <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer"
              style={{ display: "flex", flexDirection: "column", padding: "9px 12px", borderRadius: "var(--r-card)", background: "var(--surface)", border: "1px solid var(--border)" }}>
              <span style={{ font: "600 13px/1.2 var(--ff)", color: "var(--text)" }}>{s.label} ↗</span>
              <span style={{ font: "500 11px/1.3 var(--ff)", color: "var(--text-3)", marginTop: 2 }}>{s.sublabel}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
