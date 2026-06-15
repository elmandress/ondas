"use client";

/**
 * Ficha de bus (R67): el bus seleccionado/seguido en el mapa. Parte del sistema de
 * sheets del mapa — cuando es PAR (lo tocaste en el mapa) se ancla como bottom-sheet;
 * cuando es DRILL-DOWN (lo seguís desde la hoja de parada, abovePanel) flota compacta
 * por encima. La lógica de seguimiento (followAlert/ETA/paradas) vive en MapScreen.
 */
import { useRef } from "react";
import { motion } from "framer-motion";
import type { VehiclePosition } from "@/lib/stm";
import { titleCaseDestination } from "@/lib/utils";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import LineBadge from "@/components/ui/LineBadge";
import { Icons } from "@/components/brand/Icons";

interface Props {
  vehicle: VehiclePosition;
  followAlert: "now" | "soon" | null;
  followedStops: number | null;
  followedEta: number | null;
  /** true si el panel de parada está abierto debajo (drill-down: la ficha se apila). */
  abovePanel: boolean;
  onOpenLineDetail: (line: string, destination?: string, company?: string) => void;
  onClose: () => void;
}

export default function VehicleCard({
  vehicle, followAlert, followedStops, followedEta, abovePanel, onOpenLineDetail, onClose,
}: Props) {
  const hasRich = vehicle.nextStop || vehicle.delayMin != null || vehicle.occupancy != null;
  const cardRef = useRef<HTMLDivElement>(null);
  useFocusTrap(cardRef); // R70: ficha-bus (par o drill-down sobre la parada) atrapa el foco arriba
  return (
    <motion.div
      ref={cardRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Bus línea ${vehicle.lineName}`}
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 80, opacity: 0 }}
      transition={{ type: "spring", damping: 26, stiffness: 280 }}
      className={`ficha-bus ${abovePanel ? "stacked" : "sheet"}`}
    >
      {/* Alerta "prepárate / ¡bajate!": el bus seguido está por llegar a tu parada.
          Combina paradas restantes + minutos (dos referencias bajan la ansiedad). */}
      {followAlert && (
        <div className={`follow-alert ${followAlert}`}>
          <Icons.Bus size={16} />
          <span>{followAlert === "now"
            ? "¡Está llegando! Salí a la parada ahora"
            : (() => {
                const stopsTxt = followedStops != null && followedStops > 0
                  ? `Faltan ${followedStops} parada${followedStops > 1 ? "s" : ""}` : null;
                const minTxt = followedEta != null ? `~${followedEta} min` : null;
                const both = [stopsTxt, minTxt].filter(Boolean).join(" · ");
                return both ? `${both} — prepárate` : "Tu bus se acerca — prepárate";
              })()}</span>
        </div>
      )}

      <div className="fb-card">
        {!abovePanel && <div className="fb-handle" aria-hidden />}
        <div className="fb-row">
          {/* Tocar la ficha → abre el MISMO detalle de línea que en Inicio
              (recorrido, paradas, tiempos, empresa, wifi). */}
          <button className="fb-main" onClick={() => onOpenLineDetail(vehicle.lineName, vehicle.destinoDesc, vehicle.company)}>
            <LineBadge num={vehicle.lineName} size="md" />
            <div className="fb-text">
              <p className="fb-dest">{vehicle.destinoDesc ? titleCaseDestination(vehicle.destinoDesc) : `Línea ${vehicle.lineName}`}</p>
              {hasRich && (
                <p className="fb-rich">
                  {vehicle.nextStop && <span className="fb-next">→ {vehicle.nextStop}</span>}
                  {vehicle.delayMin != null && Math.abs(vehicle.delayMin) >= 1 && (
                    <span className={vehicle.delayMin > 0 ? "fb-late" : "fb-early"}>
                      {" · "}{vehicle.delayMin > 0 ? `${vehicle.delayMin} min tarde` : `${-vehicle.delayMin} min adelantado`}
                    </span>
                  )}
                  {vehicle.occupancy != null && vehicle.occupancy > 0 && (
                    <span className="fb-occ">{" · "}~{vehicle.occupancy} pasajeros</span>
                  )}
                </p>
              )}
              <p className="fb-meta">
                Bus #{vehicle.vehicleId}
                {vehicle.speed > 0 && <> · <span className="tnum">{Math.round(vehicle.speed)}</span> km/h</>}
                <span className="fb-link"> · Ver recorrido ›</span>
              </p>
            </div>
          </button>
          <button onClick={onClose} className="fb-close" aria-label="Cerrar">
            <Icons.Close size={16} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
