"use client";

import { useState } from "react";
import { Icons } from "@/components/brand/Icons";
import type { PlannedRouteDto } from "@/hooks/useRouteplanner";
import { uberDeepLink, mapsRideLink, isNightTariff } from "@/lib/rideshare";
import { walkAdvisory } from "@/lib/safety-zones";

function haversineM(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/**
 * Opción SECUNDARIA: combinar el bus con taxi/Uber para el último tramo a pie.
 * No es la opción principal (el bus lo es): aparece como sugerencia y solo cuando
 * aporta — sobre todo de noche si ese tramo final cae en una zona poco transitada.
 *
 * Respetuoso: no nombramos barrios ni decimos "peligrosa"; hablamos de "zona poco
 * transitada / con poca luz de noche". Sin precio inventado: lo pone la app.
 */
export default function MixedTripOption({
  route,
  destinationName,
}: {
  route: PlannedRouteDto;
  destinationName?: string;
}) {
  const [open, setOpen] = useState(false);

  const last = route.legs[route.legs.length - 1];
  const hasBus = route.legs.some((l) => l.type === "bus");
  if (!hasBus || !last || last.type !== "walk" || !last.polyline || last.polyline.length < 2) {
    return null;
  }

  const from = last.polyline[0];
  const to = last.polyline[last.polyline.length - 1];
  const distM = Math.round(haversineM(from, to));
  const night = isNightTariff();
  const level = walkAdvisory(distM, to[0], to[1], night);
  if (level === "none") return null;

  const recommend = level === "recommend";
  const pickup = { lat: from[0], lon: from[1] };
  const dropoff = { lat: to[0], lon: to[1] };
  const uber = uberDeepLink(pickup, dropoff, destinationName);
  const maps = mapsRideLink(dropoff);
  const walkMin = Math.max(1, Math.round((last.durationS || distM / 1.25) / 60));

  // Encabezado discreto que se puede expandir (no empuja el taxi de entrada).
  const headline = recommend
    ? "De noche, este último tramo conviene en taxi"
    : "¿Preferís no caminar el último tramo?";
  const detail = recommend
    ? `Son ${distM} m a pie (~${walkMin} min) por una zona poco transitada de noche. Si querés, bajás en la última parada y pedís un taxi o Uber.`
    : `El último tramo son ${distM} m a pie (~${walkMin} min). Si preferís, podés pedir un taxi o Uber desde la última parada.`;

  return (
    <div className={`mixed-trip ${recommend ? "recommend" : ""}`}>
      <button className="mixed-trip-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="mixed-trip-ico" aria-hidden>
          {recommend ? <Icons.Warn size={15} /> : <Icons.Route size={15} />}
        </span>
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
            <a className="mixed-trip-btn" href={uber} target="_blank" rel="noopener noreferrer">
              Abrir en Uber
            </a>
            <a className="mixed-trip-btn" href={maps} target="_blank" rel="noopener noreferrer">
              Otra app
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
