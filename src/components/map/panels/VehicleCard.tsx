"use client";

/**
 * Card flotante del bus seleccionado/seguido en el mapa, con la alerta
 * "prepárate / ¡bajate!" cuando se acerca a tu parada. La lógica de
 * seguimiento (followAlert/ETA/paradas restantes) vive en MapScreen porque
 * depende de arrivals + selección; acá solo se presenta.
 */
import { motion } from "framer-motion";
import type { VehiclePosition } from "@/lib/stm";
import { titleCaseDestination } from "@/lib/utils";
import LineBadge from "@/components/ui/LineBadge";
import { Icons } from "@/components/brand/Icons";

interface Props {
  vehicle: VehiclePosition;
  followAlert: "now" | "soon" | null;
  followedStops: number | null;
  followedEta: number | null;
  /** true si el panel de parada está abierto debajo (la card se eleva). */
  abovePanel: boolean;
  onOpenLineDetail: (line: string, destination?: string, company?: string) => void;
  onClose: () => void;
}

export default function VehicleCard({
  vehicle, followAlert, followedStops, followedEta, abovePanel, onOpenLineDetail, onClose,
}: Props) {
  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 80, opacity: 0 }}
      transition={{ type: "spring", damping: 26, stiffness: 280 }}
      className={`map-overlay-card map-vehicle-card absolute left-3 right-3 z-[1002] ${abovePanel ? "above-panel" : ""}`}
      style={{ bottom: "calc(20px + env(safe-area-inset-bottom))" }}
    >
      {/* Alerta "prepárate / ¡bajate!": el bus seguido está por llegar a tu parada.
          Combina paradas restantes + minutos (patrón Amap "a 3 paradas · ~6 min"):
          dos referencias reducen la ansiedad de "¿cuánto falta?". Cae a lo que haya. */}
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
      <div className="bg-[#0a0f1c]/95 backdrop-blur-xl p-3 border border-amber-500/30" style={{ borderRadius: "var(--r-card)", boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center justify-between gap-2">
          {/* Tocar el bus/badge → abre el MISMO detalle de línea que en Inicio:
              recorrido completo, paradas, tiempos, empresa, web, wifi. */}
          <button
            className="flex items-center gap-3 min-w-0 flex-1 text-left"
            onClick={() => onOpenLineDetail(vehicle.lineName, vehicle.destinoDesc, vehicle.company)}
          >
            <LineBadge num={vehicle.lineName} size="md" />
            <div className="min-w-0 flex-1">
              <p className="text-white font-bold text-sm truncate">{vehicle.destinoDesc ? titleCaseDestination(vehicle.destinoDesc) : `Línea ${vehicle.lineName}`}</p>
              {/* Datos ricos del GPS del interior (próxima parada / atraso / ocupación). */}
              {(vehicle.nextStop || vehicle.delayMin != null || vehicle.occupancy != null) && (
                <p className="text-[11px] truncate mt-0.5">
                  {vehicle.nextStop && <span className="text-slate-300">→ {vehicle.nextStop}</span>}
                  {vehicle.delayMin != null && Math.abs(vehicle.delayMin) >= 1 && (
                    <span className={vehicle.delayMin > 0 ? "text-amber-400" : "text-emerald-400"}>
                      {" · "}{vehicle.delayMin > 0 ? `${vehicle.delayMin} min tarde` : `${-vehicle.delayMin} min adelantado`}
                    </span>
                  )}
                  {vehicle.occupancy != null && vehicle.occupancy > 0 && (
                    <span className="text-slate-400">{" · "}~{vehicle.occupancy} pasajeros</span>
                  )}
                </p>
              )}
              <p className="text-slate-500 text-[11px] truncate">
                Bus #{vehicle.vehicleId}
                {vehicle.speed > 0 && <> · {Math.round(vehicle.speed)} km/h</>}
                <span className="text-amber-400 font-semibold"> · Ver recorrido ›</span>
              </p>
            </div>
          </button>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/[0.06] flex items-center justify-center flex-shrink-0"
            aria-label="Cerrar"
          >
            <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
    </motion.div>
  );
}
