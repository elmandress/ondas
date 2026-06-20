"use client";

/**
 * Ficha de bus (R67): el bus seleccionado/seguido en el mapa. Parte del sistema de
 * sheets del mapa — cuando es PAR (lo tocaste en el mapa) se ancla como bottom-sheet;
 * cuando es DRILL-DOWN (lo seguís desde la hoja de parada, abovePanel) flota compacta
 * por encima. La lógica de seguimiento (followAlert/ETA/paradas) vive en MapScreen.
 */
import { useRef, useState } from "react";
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
  /** Feature A: notificación local del OS cuando falten N paradas. */
  notifySupported: boolean;
  notifyAt: number | null;
  notifyDenied: boolean;
  onSetNotify: (n: number | null) => void;
  /** Feature E: paradas aguas abajo del bus para elegir destino ("estoy en el bus"). */
  destOptions: { stopId: string; name: string; distM: number }[];
  selectedDestStopId: string | null;
  onSetDest: (id: string | null) => void;
  onOpenLineDetail: (line: string, destination?: string, company?: string) => void;
  onClose: () => void;
}

export default function VehicleCard({
  vehicle, followAlert, followedStops, followedEta, abovePanel,
  notifySupported, notifyAt, notifyDenied, onSetNotify,
  destOptions, selectedDestStopId, onSetDest, onOpenLineDetail, onClose,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const destName = destOptions.find((o) => o.stopId === selectedDestStopId)?.name;
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
            ? (selectedDestStopId
                ? `¡Bajate ahora! Llegás a ${destName || "tu destino"}`
                : "¡Está llegando! Salí a la parada ahora")
            : (() => {
                const stopsTxt = followedStops != null && followedStops > 0
                  ? `${followedStops} parada${followedStops > 1 ? "s" : ""}` : null;
                const minTxt = followedEta != null ? `~${followedEta} min` : null;
                const both = [stopsTxt, minTxt].filter(Boolean).join(" · ");
                // Modo viaje (E): "bajás en…"; modo seguimiento: "faltan… — prepárate".
                if (selectedDestStopId) return both ? `Bajás en ${both}` : "Te acercás a tu destino";
                return both ? `Faltan ${both} — prepárate` : "Tu bus se acerca — prepárate";
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

        {/* Feature E (Paso 2): "voy hasta…" — elegir destino entre las paradas que el bus
            tiene por delante. Al elegir, el countdown apunta al destino (lógica del Paso 1). */}
        {abovePanel && destOptions.length > 0 && (
          <div className="fb-dest">
            {selectedDestStopId ? (
              <button className="fb-dest-chosen" onClick={() => onSetDest(null)} aria-label="Cambiar destino">
                <Icons.Pin size={14} /> Bajás en <b>{destName || "tu parada"}</b>
                <span className="fb-dest-change">cambiar</span>
              </button>
            ) : (
              <>
                <button className="fb-dest-toggle" onClick={() => setPickerOpen((o) => !o)} aria-expanded={pickerOpen}>
                  <Icons.Pin size={14} /> Voy hasta…
                  <span style={{ marginLeft: "auto", display: "grid", transform: pickerOpen ? "rotate(90deg)" : "none", transition: "transform .18s" }}><Icons.Chevron size={15} /></span>
                </button>
                {pickerOpen && (
                  <div className="fb-dest-list scrollbar-none" role="listbox" aria-label="Elegí tu parada de destino">
                    {destOptions.map((o) => (
                      <button key={o.stopId} className="fb-dest-row" role="option" aria-selected={false} onClick={() => { onSetDest(o.stopId); setPickerOpen(false); }}>
                        <span className="fb-dest-name">{o.name}</span>
                        <span className="fb-dest-dist">{o.distM < 1000 ? `${o.distM} m` : `${(o.distM / 1000).toFixed(1)} km`}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Feature A: avisame a N paradas. Explícito (no automático) + N configurable. La
            notificación del OS aparece en la pantalla de bloqueo (a diferencia de la voz). */}
        {notifySupported && abovePanel && (
          <div className="fb-notify">
            <span className="fb-notify-label">Avisame cuando falten</span>
            {[3, 2, 1].map((n) => (
              <button
                key={n}
                className={`fb-notify-chip ${notifyAt === n ? "on" : ""}`}
                onClick={() => onSetNotify(notifyAt === n ? null : n)}
                aria-pressed={notifyAt === n}
                aria-label={`Avisarme cuando falten ${n} ${n === 1 ? "parada" : "paradas"}`}
              >
                {n}
              </button>
            ))}
            <span className="fb-notify-unit">{notifyAt != null ? `${notifyAt === 1 ? "parada" : "paradas"} ✓` : "paradas"}</span>
            {notifyDenied && <div className="fb-notify-denied">Activá las notificaciones del navegador para esto.</div>}
          </div>
        )}
      </div>
    </motion.div>
  );
}
