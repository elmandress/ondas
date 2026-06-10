"use client";

/**
 * Inputs del planificador: fila de lugar (Desde/Hacia/waypoint) y selector de
 * hora de salida. Componentes presentacionales — el estado vive en RouteScreen.
 */
import { useState } from "react";
import { Icons } from "@/components/brand/Icons";
import type { Place } from "@/components/route/types";

export function PlaceInput({
  label, place, active, kind, onFocus, onClear,
}: { label: string; place: Place | null; active: boolean; kind: "from" | "to" | "waypoint"; onFocus: () => void; onClear: () => void; }) {
  const lead = kind === "from" ? <Icons.Crosshair size={16} /> : kind === "waypoint" ? <Icons.Clock size={15} /> : <Icons.Pin size={16} />;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onFocus}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onFocus(); }}
      className={`input-row ${kind}`}
      style={active ? { background: "var(--accent-soft)", borderRadius: 12, marginInline: -8, paddingInline: 8 } : undefined}
    >
      <span className="lead">{lead}</span>
      <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
        <div className="eyebrow" style={{ marginBottom: 1 }}>{label || "Pasar por"}</div>
        {place ? (
          <p style={{ font: "600 16px/1.2 var(--ff)", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{place.name}</p>
        ) : (
          <p style={{ font: "500 15px/1.2 var(--ff)", color: "var(--text-3)" }}>{kind === "waypoint" ? "Elegí una parada intermedia" : "Tocá para elegir"}</p>
        )}
      </div>
      {/* Pista de que es editable: lápiz cuando hay valor (tocá para cambiar). */}
      {place && (
        <span className="edit-hint" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        </span>
      )}
      {(place || kind === "waypoint") && (
        <button className="clear" onClick={(e) => { e.stopPropagation(); onClear(); }} aria-label={kind === "waypoint" ? "Quitar parada" : "Limpiar"}>×</button>
      )}
    </div>
  );
}

// ── DepartTimePicker ───────────────────────────────────────────────
// "Salir ahora" / "Salir a las HH:MM". Cuando hay hora, construye un ISO para hoy;
// si la hora ya pasó hoy, asume mañana (planificás el primer viaje de mañana).
export function DepartTimePicker({ value, onChange, children }: { value: string | null; onChange: (iso: string | null) => void; children?: React.ReactNode }) {
  const [editing, setEditing] = useState(false);

  // value (ISO) → "HH:MM" para mostrar y para el <input type=time>.
  const hhmm = value ? new Date(value).toTimeString().slice(0, 5) : "";

  const setFromHHMM = (t: string) => {
    if (!t) { onChange(null); return; }
    const [h, m] = t.split(":").map(Number);
    const d = new Date();
    d.setSeconds(0, 0);
    d.setHours(h, m, 0, 0);
    // Si la hora elegida ya pasó hoy, planificamos para mañana.
    if (d.getTime() < Date.now() - 60_000) d.setDate(d.getDate() + 1);
    onChange(d.toISOString());
  };

  return (
    <div className="depart-row">
      <button
        className={`depart-chip ${!value ? "on" : ""}`}
        onClick={() => { onChange(null); setEditing(false); }}
        aria-pressed={!value}
      >
        <Icons.Clock size={14} /> Salir ahora
      </button>

      {value && !editing ? (
        <button className="depart-chip on" onClick={() => setEditing(true)} aria-label="Cambiar hora de salida">
          Salida {hhmm}
          {new Date(value).getDate() !== new Date().getDate() && <span className="depart-day"> mañana</span>}
        </button>
      ) : (
        <label className={`depart-chip ${value ? "on" : ""}`}>
          {!value && <span style={{ opacity: 0.85 }}>Más tarde</span>}
          <input
            type="time"
            value={hhmm}
            onChange={(e) => { setFromHHMM(e.target.value); setEditing(false); }}
            className="depart-time-input"
            aria-label="Hora de salida"
          />
        </label>
      )}
      {children}
    </div>
  );
}
