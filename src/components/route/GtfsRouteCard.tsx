"use client";

/**
 * Tarjeta de una ruta planificada con el motor GTFS oficial (FR-4): resumen
 * compacto (minutos, llegada, tarifa, secuencia de tramos) y, expandida, el
 * timeline vertical paso a paso con ETA en vivo por tramo, impacto del viaje,
 * viaje mixto y acciones (ver en mapa / compartir).
 */
import { useState } from "react";
import { motion } from "framer-motion";
import type { PlannedRouteDto, RouteLegDto } from "@/hooks/useRouteplanner";
import { fareLabel, fareDetail } from "@/lib/fare";
import { walkToLeaveTime, leaveNowUrgency } from "@/lib/utils";
import { tripImpactLabel } from "@/lib/trip-impact";
import { shareTrip } from "@/lib/share-trip";
import { useNextArrivalForLine } from "@/hooks/useNextArrivalForLine";
import { Icons } from "@/components/brand/Icons";
import LineBadge from "@/components/ui/LineBadge";
import MixedTripOption from "@/components/route/MixedTripOption";

export default function GtfsRouteCard({
  route, onTapStop, onShowOnMap, destinationName, safeBadge, departAt,
}: {
  route: PlannedRouteDto;
  onTapStop: (id: string) => void;
  onShowOnMap?: () => void;
  destinationName?: string;
  safeBadge?: { savedWalkM: number; extraMin: number } | null;
  departAt?: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const totalMin = Math.max(1, Math.round(route.totalSeconds / 60));
  const arrivalHHMM = (() => {
    const base = departAt ? new Date(departAt) : new Date();
    const arr = new Date(base.getTime() + route.totalSeconds * 1000);
    return `${arr.getHours().toString().padStart(2, "0")}:${arr.getMinutes().toString().padStart(2, "0")}`;
  })();
  // Ruta metropolitana (Canelones): usa al menos una variante del GTFS metro (prefijo
  // "M-"). Esas líneas son por HORARIO oficial — no tenemos GPS en vivo de las empresas
  // suburbanas. Lo decimos derecho (honestidad #1).
  const usesMetro = route.legs.some((l) => l.type === "bus" && l.variantId?.startsWith("M-"));
  const isWalkOnly = route.signature === "walk";
  // Continuación de la misma línea (183→183): el recorrido cambia, no es "otra línea".
  const contLine = route.sameLineContinuation
    ? (route.legs.find((l) => l.type === "bus")?.lines?.[0] ?? null)
    : null;

  const via = route.viaWaypoints?.length ? route.viaWaypoints : null;
  const headerLabel = isWalkOnly
    ? "Caminando"
    : via
    ? `Vía ${via.join(" · ")}`
    : contLine
    ? `Seguís en el ${contLine}`
    : route.numTransfers === 0
    ? "Directa"
    : `${route.numTransfers} transbordo${route.numTransfers > 1 ? "s" : ""}`;

  // Secuencia compacta de tramos (estilo Google Maps): 🚶 → [línea] → 🚶
  const seq: React.ReactNode[] = [];
  route.legs.forEach((leg, i) => {
    if (i > 0) seq.push(<span key={`s${i}`} style={{ color: "var(--text-3)" }}>›</span>);
    if (leg.type === "walk") {
      const m = Math.max(1, Math.round(leg.durationS / 60));
      seq.push(
        <span key={`l${i}`} style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "var(--text-2)", font: "var(--font-small)" }}>
          <Icons.Walk size={15} />{m}
        </span>
      );
    } else {
      const lns = leg.lines && leg.lines.length ? leg.lines : ["?"];
      lns.slice(0, 3).forEach((ln, k) => seq.push(<LineBadge key={`l${i}-${k}`} num={ln} size="sm" />));
      if (lns.length > 3) seq.push(<span key={`l${i}m`} style={{ color: "var(--text-3)", font: "var(--font-small)" }}>+{lns.length - 3}</span>);
    }
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="card route-card overflow-hidden"
    >
      {/* RESUMEN compacto — tocar para ver el paso a paso */}
      <button onClick={() => setExpanded((e) => !e)} className="w-full text-left flex items-center gap-3 px-4 py-3.5">
        <div className="flex-shrink-0">
          <p style={{ font: "800 24px/1 var(--ff)", letterSpacing: "-0.02em" }}>
            {totalMin}<span style={{ font: "600 13px/1 var(--ff)", color: "var(--text-2)" }}> min</span>
          </p>
          <p style={{ font: "600 12px/1 var(--ff)", color: "var(--accent)", marginTop: 2 }}>→ {arrivalHHMM}</p>
          <p className="text-eyebrow" style={{ marginTop: 3 }}>{headerLabel}</p>
          {/* Costo del boleto (tabla oficial fare.ts). Suburbano usa tarifa metropolitana
              distinta ($86+, aumentó 01/06/2026). Solo rutas con bus. */}
          {!isWalkOnly && (
            <p style={{ font: "600 11px/1 var(--ff)", color: "var(--text-3)", marginTop: 3 }}>
              {fareLabel(route.numTransfers, usesMetro)}
            </p>
          )}
        </div>
        <div className="flex-1 flex items-center gap-1.5 flex-wrap justify-end">
          {seq}
        </div>
        <span style={{ color: "var(--text-3)", transform: expanded ? "rotate(90deg)" : "none", transition: "transform 0.18s", display: "inline-flex" }}>
          <Icons.Chevron size={18} />
        </span>
      </button>

      {/* Sello "más tranquila de noche": recomendación contextual real (no decorativa) —
          esta opción reduce la caminata nocturna por poco más de tiempo. */}
      {safeBadge && (
        <div className="safe-badge">
          <span className="sb-moon" aria-hidden><Icons.Moon size={14} /></span>
          <span>
            Más tranquila de noche · caminás <b>{safeBadge.savedWalkM} m menos</b>
            {safeBadge.extraMin > 0 ? <> por solo <b>+{safeBadge.extraMin} min</b></> : null}
          </span>
        </div>
      )}

      {/* R58: el "Tocá para ver el paso a paso" repetido en CADA card era ruido —
          el chevron ya lo dice. Solo conservamos el dato que aporta (alternativas). */}
      {!expanded && route.alternatives != null && route.alternatives > 0 && (
        <div className="px-4 pb-3 -mt-1" style={{ font: "var(--font-small)", color: "var(--text-3)" }}>
          {route.alternatives} {route.alternatives === 1 ? "alternativa cercana" : "alternativas cercanas"} · tocá para ver
        </div>
      )}

      {expanded && <>
      <div className="divider" />

      <div className="px-4 py-5">
        {/* R61: "Salí en X" — el DIFERENCIAL de la app ("te decimos cuándo SALIR")
            llevado al paso a paso, donde más importa. Solo en modo "salí ahora"
            (no si elegiste "Más tarde", donde la salida es la hora elegida). Usa el
            MISMO fetch que el timeline (cache compartido) → cero red extra. */}
        {!isWalkOnly && !departAt && (() => {
          let walkBefore = 0;
          for (const l of route.legs) {
            if (l.type === "walk") { walkBefore += l.durationS; continue; }
            return (
              <LeaveBanner
                stopId={l.fromStopId}
                line={(l.lines && l.lines[0]) || ""}
                walkMin={Math.round(walkBefore / 60)}
              />
            );
          }
          return null;
        })()}
        {usesMetro && (
          <div className="metro-note" style={{ marginBottom: 16 }}>
            <Icons.Bus size={15} />
            <span>Viaje <b>metropolitano</b> (Canelones). Estos horarios son los <b>oficiales programados</b> del MTOP — todavía no tenemos GPS en vivo de las empresas suburbanas, así que mostramos el horario, no la posición real.</span>
          </div>
        )}
        {contLine && (
          <div className="cont-note" style={{ marginBottom: 16 }}>
            <Icons.Warn size={15} />
            <span>El <b>{contLine}</b> cambia de recorrido en el camino. Seguís en un <b>{contLine}</b> desde la misma parada — puede ser el mismo coche o el próximo de la línea. Te lo decimos derecho, sin inventar.</span>
          </div>
        )}

        {/* Timeline vertical: queda CLARO que caminás a la parada, ahí esperás y
            tomás el bondi, te bajás, y caminás al destino. */}
        <ol className="trip-timeline">
          {/* Nodo ORIGEN */}
          <li className="tl-node">
            <span className="tl-dot tl-dot-origin" />
            <div className="tl-body">
              <p className="tl-main">Tu ubicación</p>
              <p className="tl-sub">Empezás acá</p>
            </div>
          </li>

          {route.legs.map((leg, i) => {
            const minutes = Math.max(1, Math.round(leg.durationS / 60));
            if (leg.type === "walk") {
              return (
                <li className="tl-node" key={i}>
                  <span className="tl-line tl-line-walk" />
                  <span className="tl-icon"><Icons.Walk size={15} /></span>
                  <div className="tl-body">
                    <p className="tl-main">Caminá {minutes} min{isWalkOnly ? " hasta el destino" : ""}</p>
                    <p className="tl-sub">
                      {leg.distanceM}m{!isWalkOnly && leg.toStopName ? <> · llegás a <b>{leg.toStopName}</b></> : isWalkOnly ? "" : ""}
                    </p>
                  </div>
                </li>
              );
            }
            // BUS: nodo de PARADA con badge de la línea — "acá te tomás el bondi".
            return (
              <BusTimelineLeg
                key={i}
                leg={leg}
                minutes={minutes}
                onTapStop={onTapStop}
              />
            );
          })}

          {/* Nodo DESTINO */}
          {!isWalkOnly && (
            <li className="tl-node">
              <span className="tl-line tl-line-walk" />
              <span className="tl-dot tl-dot-dest" />
              <div className="tl-body">
                <p className="tl-main">{destinationName || "Destino"}</p>
                <p className="tl-sub">Llegaste 🎉</p>
              </div>
            </li>
          )}
        </ol>

        {/* Impacto del viaje (CO₂ + calorías) — OPT-IN y discreto. Va dentro de un
            desplegable cerrado por defecto: no es el foco (el foco es "qué bus tomo").
            Decisión de producto: NO mostrarlo siempre para no sentirse moralista ni
            "relleno"; el uruguayo quiere saber qué bondi tomar, no un sermón verde.
            Solo aparece si el usuario TOCA "Ver impacto del viaje". */}
        {!isWalkOnly && (() => {
          const busM = route.legs.filter((l) => l.type === "bus").reduce((s, l) => s + (l.distanceM || 0), 0);
          const walkMin = Math.round(route.legs.filter((l) => l.type === "walk").reduce((s, l) => s + l.durationS, 0) / 60);
          const label = tripImpactLabel(busM, walkMin);
          return label ? (
            <details className="trip-impact-details">
              <summary>Ver impacto del viaje</summary>
              <div className="trip-impact-body">{label}</div>
            </details>
          ) : null;
        })()}

        {/* Detalle de tarifa con VIGENCIA — en la ruta expandida (no en el resumen, para
            no saturar). Aclara que es estimado y de cuándo son los valores. */}
        {!isWalkOnly && (
          <p style={{ font: "500 11px/1.4 var(--ff)", color: "var(--text-3)", marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
            <span>🎫</span>{fareDetail(route.numTransfers, usesMetro)}
          </p>
        )}

        {/* Viaje mixto: taxi/Uber para el último tramo (de noche o si la caminata es larga) */}
        <MixedTripOption route={route} destinationName={destinationName} />

        {/* Acciones: ver en el mapa + compartir — solo para rutas con bus. */}
        {!isWalkOnly && (
          <div className="mt-2 flex gap-2">
            {onShowOnMap && (
              <button
                onClick={onShowOnMap}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-2)" }}
              >
                <Icons.Map size={16} />
                Ver en el mapa
              </button>
            )}
            {/* Compartir el viaje (Web Share API → portapapeles). "Te aviso por dónde voy". */}
            <button
              onClick={async () => {
                const r = await shareTrip(route, destinationName);
                if (r === "copied") { setShareMsg("Copiado ✓"); setTimeout(() => setShareMsg(null), 1800); }
                else if (r === "error") { setShareMsg("No se pudo compartir"); setTimeout(() => setShareMsg(null), 1800); }
              }}
              aria-label="Compartir viaje"
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-2)", minWidth: shareMsg ? undefined : 48 }}
            >
              {shareMsg ? (
                <span style={{ font: "600 12px/1 var(--ff)" }}>{shareMsg}</span>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
              )}
            </button>
          </div>
        )}
      </div>
      </>}
    </motion.div>
  );
}

// ── LeaveBanner ────────────────────────────────────────────────────
// "Salí en X min / Salí ahora" — el diferencial de Cuándo en el paso a paso.
// Comparte el cache de useNextArrivalForLine con el timeline (mismo stopId+line),
// así que no agrega ninguna llamada de red.
function LeaveBanner({ stopId, line, walkMin }: { stopId?: string; line: string; walkMin: number }) {
  const { etaMin, realtime, loading } = useNextArrivalForLine(stopId, line);
  if (loading || etaMin === null) return null;
  const leaveIn = walkToLeaveTime(walkMin, etaMin);
  const urgency = leaveNowUrgency(leaveIn);
  const txt = leaveIn <= 0 ? "Salí ahora" : `Salí en ${leaveIn} min`;
  const sub = leaveIn <= 0
    ? `el ${line} llega en ${etaMin === 0 ? "<1" : etaMin} min`
    : `para tomar el ${line} (${realtime ? "en vivo" : "horario"})`;
  return (
    <div className={`leave-banner u-${urgency}`} role="status">
      <span className="lb-icon"><Icons.Clock size={16} /></span>
      <div className="lb-text"><b>{txt}</b><span>{sub}</span></div>
    </div>
  );
}

// ── BusTimelineLeg ─────────────────────────────────────────────────
// Nodo de bus en el timeline: deja CLARO que te subís a la línea en una parada
// concreta, esperás el próximo, y te bajás N paradas después. La parada es el nodo.
function BusTimelineLeg({
  leg, minutes, onTapStop,
}: {
  leg: RouteLegDto;
  minutes: number;
  onTapStop: (id: string) => void;
}) {
  const lines = leg.lines && leg.lines.length ? leg.lines : ["?"];
  const lineList = lines.length > 1
    ? `${lines.slice(0, -1).join(", ")} o ${lines[lines.length - 1]}`
    : lines[0];
  const dest = (leg.headsign || "").split(" ").slice(0, 4).join(" ");
  const { etaMin, realtime, loading } = useNextArrivalForLine(leg.fromStopId, lines[0]);

  let nextLabel = "", nextClass = "";
  if (loading) { nextLabel = "Buscando próximo…"; nextClass = "tl-next-muted"; }
  else if (etaMin !== null) {
    nextLabel = `${realtime ? "● en vivo" : "○ horario"} · próximo en ${etaMin === 0 ? "<1" : etaMin} min`;
    nextClass = etaMin <= 3 ? "tl-next-soon" : "tl-next";
  }

  return (
    <li className="tl-node tl-node-bus">
      <span className="tl-line tl-line-bus" />
      {/* El nodo es la PARADA donde te subís (círculo con el badge de la línea). */}
      <button
        className="tl-stop-dot"
        onClick={() => leg.fromStopId && onTapStop(leg.fromStopId)}
        aria-label="Ver llegadas de esta parada"
      >
        <LineBadge num={lines[0]} size="sm" />
      </button>
      <div className="tl-body">
        <button className="tl-bus-head" onClick={() => leg.fromStopId && onTapStop(leg.fromStopId)}>
          <p className="tl-main">
            Tomá el <b>{lineList}</b>{dest && <> hacia {dest}</>}
          </p>
          <span className="tl-llegadas">Llegadas <Icons.Chevron size={12} /></span>
        </button>
        <p className="tl-sub">
          En <b>{leg.fromStopName || "la parada"}</b> · {leg.numStops ?? "?"} paradas · {minutes} min
        </p>
        {nextLabel && <p className={`tl-nextline ${nextClass}`}>{nextLabel}</p>}
        {leg.closingSoon && typeof leg.endOfServiceMin === "number" && (
          <p className="tl-closing">
            <Icons.Clock size={12} /> Última corrida ~{String(Math.floor(leg.endOfServiceMin / 60) % 24).padStart(2, "0")}:{String(leg.endOfServiceMin % 60).padStart(2, "0")}
          </p>
        )}
      </div>
    </li>
  );
}
