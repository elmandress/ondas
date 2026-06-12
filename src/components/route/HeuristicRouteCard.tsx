"use client";

/**
 * Tarjeta de ruta del planner HEURÍSTICO (fallback cuando el motor GTFS no
 * devuelve opciones): pasos resumidos con caminata OSRM lazy al expandir.
 */
import { useState } from "react";
import { motion } from "framer-motion";
import type { RouteCandidate } from "@/lib/route-planner";
import { walkingMinutes } from "@/lib/utils";
import { useWalkingSteps } from "@/hooks/useWalkingSteps";
import type { Place } from "@/components/route/types";

export default function HeuristicRouteCard({
  route, origin, destination, onTapStop,
}: {
  route: RouteCandidate;
  origin: Place;
  destination: Place;
  onTapStop: (id: string) => void;
}) {
  const isWalk = route.type === "walk";
  const isTransfer = route.type === "transfer";
  const totalMin = route.estimatedMinutes;
  const [expanded, setExpanded] = useState(false);

  // SRS FR-4.3 + FR-4.9: pasos peatonales reales con calles (OSRM).
  // Solo se piden cuando el usuario expande la opción (lazy).
  const walkFromTo = isWalk
    ? { from: origin, to: destination }
    : route.fromStop
    ? { from: origin, to: { lat: route.fromStop.stopLat, lon: route.fromStop.stopLon } }
    : null;
  const walkToFrom = !isWalk && route.toStop
    ? { from: { lat: route.toStop.stopLat, lon: route.toStop.stopLon }, to: destination }
    : null;

  const { route: walkInitial } = useWalkingSteps(walkFromTo?.from || null, walkFromTo?.to || null, expanded);
  const { route: walkFinal } = useWalkingSteps(walkToFrom?.from || null, walkToFrom?.to || null, expanded);

  // Tiempo del tramo peatonal corregido por OSRM (si llegó)
  const realWalkFromMin = walkInitial ? Math.max(1, Math.round(walkInitial.durationS / 60)) : walkingMinutes(route.walkFromMeters);
  const realWalkToMin = isWalk
    ? 0
    : walkFinal
    ? Math.max(1, Math.round(walkFinal.durationS / 60))
    : walkingMinutes(route.walkToMeters || 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="card overflow-hidden"
    >
      <button onClick={() => setExpanded((e) => !e)} className="w-full text-left">
        <div className="px-4 pt-3.5 pb-3 flex items-center justify-between">
          <div>
            <p className="text-eyebrow mb-0.5">Opción {isWalk ? "Caminando" : isTransfer ? "Transbordo" : "Directa"}</p>
            <p className="text-headline">~{totalMin} min total</p>
          </div>
          {!isWalk && !isTransfer && (
            <div className="flex gap-1 flex-wrap justify-end max-w-[60%]">
              {route.sharedLines.slice(0, 4).map((l) => (
                <span key={l} className="text-[11px] font-black px-2 py-1 rounded-md text-white"
                  style={{ background: "rgba(255,255,255,0.08)", border: "1px solid var(--border-strong)", letterSpacing: "-0.02em" }}>
                  {l}
                </span>
              ))}
              {route.sharedLines.length > 4 && (
                <span className="text-[11px] text-slate-500 font-semibold self-center">+{route.sharedLines.length - 4}</span>
              )}
            </div>
          )}
          {isTransfer && (
            <div className="flex items-center gap-1.5 justify-end">
              <span className="text-[11px] font-black px-2 py-1 rounded-md text-white" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid var(--border-strong)" }}>{route.transferLine1}</span>
              <svg className="w-3 h-3 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><polyline points="9 18 15 12 9 6" /></svg>
              <span className="text-[11px] font-black px-2 py-1 rounded-md text-white" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid var(--border-strong)" }}>{route.transferLine2}</span>
            </div>
          )}
        </div>
      </button>

      <div className="divider" />

      {/* Pasos resumidos */}
      <div className="px-4 py-3 space-y-2.5">
        {isWalk ? (
          <WalkingSection minutes={realWalkFromMin} meters={route.walkFromMeters} steps={expanded ? walkInitial?.steps : undefined} fallbackLabel="hasta el destino" />
        ) : isTransfer ? (
          <>
            <WalkingSection minutes={realWalkFromMin} meters={route.walkFromMeters} steps={expanded ? walkInitial?.steps : undefined} fallbackLabel="hasta la parada" />
            <button onClick={() => onTapStop(route.fromStop!.stopId)} className="w-full text-left">
              <Step icon="bus" main={`Tomá el ${route.transferLine1}`} sub={`Desde ${route.fromStop!.stopName}`} action="Llegadas" />
            </button>
            <button onClick={() => onTapStop(route.transferStop!.stopId)} className="w-full text-left">
              <Step icon="stop" main="Bajate en" sub={route.transferStop!.stopName} action="Ver parada" />
            </button>
            <button onClick={() => onTapStop(route.transferStop!.stopId)} className="w-full text-left">
              <Step icon="bus" main={`Transbordo: Tomá el ${route.transferLine2}`} sub={`Desde ${route.transferStop!.stopName}`} action="Llegadas" />
            </button>
            <button onClick={() => onTapStop(route.toStop!.stopId)} className="w-full text-left">
              <Step icon="stop" main="Bajate en" sub={route.toStop!.stopName} action="Ver parada" />
            </button>
            <WalkingSection minutes={realWalkToMin} meters={route.walkToMeters || 0} steps={expanded ? walkFinal?.steps : undefined} fallbackLabel="hasta el destino" />
          </>
        ) : (
          <>
            <WalkingSection minutes={realWalkFromMin} meters={route.walkFromMeters} steps={expanded ? walkInitial?.steps : undefined} fallbackLabel="hasta la parada" />
            <button onClick={() => onTapStop(route.fromStop!.stopId)} className="w-full text-left">
              <Step icon="bus" main={`Tomá ${route.sharedLines[0]}${route.sharedLines.length > 1 ? ` o ${route.sharedLines.length - 1} más` : ""}`}
                sub={`Desde ${route.fromStop!.stopName}`} action="Ver llegadas" />
            </button>
            <button onClick={() => onTapStop(route.toStop!.stopId)} className="w-full text-left">
              <Step icon="stop" main="Bajate en" sub={route.toStop!.stopName} action="Ver parada" />
            </button>
            <WalkingSection minutes={realWalkToMin} meters={route.walkToMeters || 0} steps={expanded ? walkFinal?.steps : undefined} fallbackLabel="hasta el destino" />
          </>
        )}
        {!expanded && !isWalk && (
          <button
            onClick={() => setExpanded(true)}
            className="text-xs text-amber-400 font-semibold pt-1 hover:underline"
          >
            Ver caminata paso a paso ↓
          </button>
        )}
      </div>
    </motion.div>
  );
}

/**
 * Sección de caminata con pasos detallados expandibles (SRS FR-4.3).
 * Si tiene `steps` muestra cada calle. Si no, solo el resumen.
 */
function WalkingSection({
  minutes, meters, steps, fallbackLabel,
}: {
  minutes: number;
  meters: number;
  steps?: { distanceM: number; name: string; instruction: string }[];
  fallbackLabel: string;
}) {
  if (steps && steps.length > 0) {
    return (
      <div>
        <Step icon="walk" main={`Caminá ${minutes} min`} sub={`${meters}m total`} />
        <div className="mt-1.5 ml-11 space-y-1 border-l border-white/[0.06] pl-3">
          {steps.map((s, i) => (
            <div key={i} className="text-[11px] text-slate-400 leading-tight py-0.5">
              · {s.instruction}
            </div>
          ))}
        </div>
      </div>
    );
  }
  return <Step icon="walk" main={`Caminá ${minutes} min`} sub={`${meters}m ${fallbackLabel}`} />;
}

function Step({ icon, main, sub, action }: { icon: "walk" | "bus" | "stop"; main: string; sub: string; action?: string; }) {
  const iconEl = icon === "walk" ? (
    <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="1" /><path d="M9 20l3-9" /><path d="M13 13l2 4" /><path d="M7 20h3" /><path d="M16 20h-2" /><path d="M15 10l2-2-2-1" />
    </svg>
  ) : icon === "bus" ? (
    <svg className="w-4 h-4 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="14" rx="2"/><path d="M22 9H2"/><circle cx="7" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/>
    </svg>
  ) : (
    <svg className="w-4 h-4 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 00-8 8c0 6 8 12 8 12s8-6 8-12a8 8 0 00-8-8z"/>
    </svg>
  );

  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "var(--surface)" }}>
        {iconEl}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-semibold text-white truncate">{main}</p>
        <p className="text-xs text-slate-500 truncate mt-0.5">{sub}</p>
      </div>
      {action && (
        <span className="text-[11px] text-amber-400 font-semibold flex items-center gap-0.5 flex-shrink-0">
          {action}
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </span>
      )}
    </div>
  );
}
