/**
 * Fila de llegada — minimalista (spec v2). Badge NEUTRO, destino y ETA grandes,
 * metadata sutil. Color reservado a estado (en vivo / llegando), no decoración.
 * Diferenciales: accesibilidad/AC (iconos), "a N paradas", y botón SEGUIR el bus.
 */
import { useState } from "react";
import { lineHasWifi, isAccessibleArrival, arrivalHasAc, type Arrival } from "@/lib/stm";
import { formatEta } from "@/lib/utils";
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
        <div className="dest">{arrival.destination}</div>
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

      <span className={`eta tnum ${etaClass}`}>{formatEta(arrival.eta, arrival.etaApprox)}</span>

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
