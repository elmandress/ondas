/**
 * Fila de llegada — minimalista (spec v2). Badge NEUTRO, destino y ETA grandes,
 * metadata sutil. Color reservado a estado (en vivo / llegando), no decoración.
 * Diferenciales: accesibilidad/AC (iconos), "a N paradas", y botón SEGUIR el bus.
 */
import { useState } from "react";
import { lineHasWifi, isAccessibleArrival, arrivalHasAc, type Arrival } from "@/lib/stm";
import { formatEta, titleCaseDestination } from "@/lib/utils";
import LineBadge from "@/components/ui/LineBadge";
import { Icons } from "@/components/brand/Icons";
import ScheduledPager from "@/components/ui/ScheduledPager";

export default function ArrivalRow({
  arrival,
  stopId,
  onLinePress,
  onFollow,
  following,
}: {
  arrival: Arrival;
  /** Parada actual — habilita el pager de próximos horarios programados (‹ ›). */
  stopId?: string;
  /** Tocar el badge → ver recorrido de la línea (con empresa en vivo si la hay). */
  onLinePress?: (line: string, destination: string, company?: string) => void;
  /** Botón "seguir": centra y sigue el bus en el mapa (solo si hay bus en vivo). */
  onFollow?: () => void;
  /** El bus de esta fila está siendo seguido (botón en ámbar). */
  following?: boolean;
}) {
  // Urgencia con SIGNIFICADO (no todo gris): verde "ya viene" (≤2min), ámbar "pronto"
  // (≤6min), neutro "falta". Da jerarquía — un bus a 1h no se ve igual que uno a 3min.
  const arriving = arrival.eta <= 2;
  const soon = arrival.eta > 2 && arrival.eta <= 6;
  const etaClass = arriving ? "urgent" : soon ? "soon" : "";
  const accessible = isAccessibleArrival(arrival);
  const ac = arrivalHasAc(arrival);
  const wifi = lineHasWifi(arrival.lineName); // solo líneas 100% eléctricas confirmadas
  const [showPager, setShowPager] = useState(false);
  const canPage = !!stopId;

  return (
    <div className={`arrival-row-wrap ${showPager ? "expanded" : ""}`}>
    <div className="arrival-row">
      {onLinePress ? (
        <button
          onClick={(e) => { e.stopPropagation(); onLinePress(arrival.lineName, arrival.destination, arrival.company); }}
          title={`Ver recorrido línea ${arrival.lineName}`}
          className="tap-card"
        >
          <LineBadge num={arrival.lineName} size="lg" />
        </button>
      ) : (
        <LineBadge num={arrival.lineName} size="lg" />
      )}

      <div className="body">
        {/* Title Case (R58): "Punta Carretas (por Parque)" en vez de "PUNTA CARRETA…" —
            lee mejor y entra más texto antes de truncar. */}
        <div className="dest">{titleCaseDestination(arrival.destination)}</div>
        <div className="arrival-sub">
          {arrival.realtime ? (
            <span className="as-live"><span className="as-dot" />en vivo</span>
          ) : (
            <span className="as-muted">horario</span>
          )}
          {arrival.remainingStops !== undefined && arrival.remainingStops > 0 && (
            <span className="as-muted">· a {arrival.remainingStops} {arrival.remainingStops === 1 ? "parada" : "paradas"}</span>
          )}
          {accessible && <span className="as-amenity" title="Accesible (piso bajo)"><Icons.Wheelchair size={14} /></span>}
          {ac && <span className="as-amenity" title="Aire acondicionado"><Icons.Ac size={15} /></span>}
          {wifi && <span className="as-amenity" title="WiFi a bordo (eléctrico)"><Icons.Wifi size={14} /></span>}
          {arrival.isShortened && <span className="as-warn">acortado</span>}
          {arrival.isLastOfDay && <span className="as-last">· último del día</span>}
        </div>
      </div>

      <span className={`eta tnum ${etaClass}`} style={{ textAlign: "right" }}>
        {/* Texto para lector de pantalla: el número grande solo ("5 min") no dice
            QUÉ significa. Acá sí: "llega en 5 minutos" (PG-4 accesibilidad). */}
        <span className="sr-only">
          {!Number.isFinite(arrival.eta) || arrival.eta <= 0
            ? "llegando ahora"
            : `llega en ${arrival.etaApprox ? "aproximadamente " : ""}${Math.round(arrival.eta)} ${Math.round(arrival.eta) === 1 ? "minuto" : "minutos"}`}
        </span>
        <span aria-hidden="true">
          {formatEta(arrival.eta, arrival.etaApprox)}
          {arrival.eta >= 0 && Number.isFinite(arrival.eta) && (
            <span style={{ display: "block", font: "500 11px/1 var(--ff)", color: "var(--text-3)", marginTop: 2 }}>
              {(() => { const a = new Date(Date.now() + arrival.eta * 60_000); return `${a.getHours().toString().padStart(2,"0")}:${a.getMinutes().toString().padStart(2,"0")}`; })()}
            </span>
          )}
        </span>
      </span>

      {canPage && (
        <button
          onClick={(e) => { e.stopPropagation(); setShowPager((v) => !v); }}
          className={`sched-toggle ${showPager ? "on" : ""}`}
          aria-label="Ver próximos horarios de esta línea"
          aria-expanded={showPager}
          title="Próximos horarios programados"
        >
          <span style={{ display: "grid", transform: showPager ? "rotate(90deg)" : "rotate(0deg)", transition: "transform .18s" }}>
            <Icons.Chevron size={16} />
          </span>
        </button>
      )}

      {onFollow && (
        <button
          onClick={(e) => { e.stopPropagation(); onFollow(); }}
          className={`follow-btn ${following ? "on" : ""}`}
          aria-label="Seguir el bus en el mapa"
          title="Seguir el bus en el mapa"
        >
          <Icons.Crosshair size={18} />
        </button>
      )}
    </div>

    {canPage && showPager && <ScheduledPager stopId={stopId!} lineName={arrival.lineName} />}
    </div>
  );
}
