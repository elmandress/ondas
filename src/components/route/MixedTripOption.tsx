"use client";

import { useState } from "react";
import { Icons } from "@/components/brand/Icons";
import type { PlannedRouteDto } from "@/hooks/useRouteplanner";
import { uberDeepLink, mapsRideLink } from "@/lib/rideshare";
import { assessTripSafety } from "@/lib/trip-safety";
import { track } from "@/lib/analytics";

/**
 * Recomendación de seguridad CONTEXTUAL del viaje (motor: lib/trip-safety).
 * No es "ofrecé taxi siempre": el motor mira la hora real, los metros a pie, si la
 * caminata va por avenida o calle interna y si toca una zona poco transitada, y recién
 * ahí sugiere algo — y solo para el TRAMO que conviene, no todo el viaje.
 *
 * Respetuoso: no nombra barrios ni dice "peligroso". Sin precio inventado (lo pone la app).
 */
export default function MixedTripOption({
  route,
  destinationName,
}: {
  route: PlannedRouteDto;
  destinationName?: string;
}) {
  const [open, setOpen] = useState(false);
  const advice = assessTripSafety(route);
  if (advice.level === "none" || !advice.action) return null;

  const { headline, detail, action, level } = advice;
  const recommend = level === "recommend";
  const reassure = level === "info"; // caminata por avenida → tono tranquilo, no warning
  const uber = action.pickup && action.dropoff ? uberDeepLink(action.pickup, action.dropoff, destinationName) : "#";
  const maps = action.dropoff ? mapsRideLink(action.dropoff) : "#";

  const Ico = recommend ? Icons.Warn : reassure ? Icons.Walk : Icons.Route;

  return (
    <div className={`mixed-trip ${recommend ? "recommend" : ""} ${reassure ? "reassure" : ""}`}>
      <button
        className="mixed-trip-toggle"
        onClick={() => { setOpen((v) => !v); if (!open) track("safety_advice_open", { level }); }}
        aria-expanded={open}
      >
        <span className="mixed-trip-ico" aria-hidden><Ico size={15} /></span>
        <span className="mixed-trip-title">{headline}</span>
        <span style={{ marginLeft: "auto", color: "var(--text-3)", transform: open ? "rotate(90deg)" : "none", transition: "transform .18s", display: "inline-flex" }}>
          <Icons.Chevron size={16} />
        </span>
      </button>

      {open && (
        <div className="mixed-trip-body">
          <p className="mixed-trip-sub">{detail}</p>
          <p className="mixed-trip-note">
            El precio lo fija la app (varía con la demanda). El taxi va con taxímetro, +20% de noche.
          </p>
          <div className="mixed-trip-actions">
            <a className="mixed-trip-btn" href={uber} target="_blank" rel="noopener noreferrer" onClick={() => track("safety_taxi_tap", { app: "uber", level })}>
              Pedir taxi para ese tramo
            </a>
            <a className="mixed-trip-btn" href={maps} target="_blank" rel="noopener noreferrer" onClick={() => track("safety_taxi_tap", { app: "maps", level })}>
              Otra app
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
