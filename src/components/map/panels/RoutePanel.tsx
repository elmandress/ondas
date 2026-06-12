"use client";

/**
 * Panel bottom-sheet de la ruta planificada (FR-4): resumen + legs con ETA
 * en vivo por tramo de bus. Se abre cuando RouteScreen setea selectedRoute
 * (store global) y el usuario pasa a la pestaña Mapa.
 */
import { motion } from "framer-motion";
import type { SelectedRouteState } from "@/lib/selected-route";
import { useNextArrivalForLine } from "@/hooks/useNextArrivalForLine";
import LineBadge from "@/components/ui/LineBadge";
import { Icons } from "@/components/brand/Icons";

interface Props {
  selectedRoute: SelectedRouteState;
  onClose: () => void;
  /** Tocar un leg de bus → abre el panel de su parada de origen. */
  onTapStop: (stopId: string) => void;
}

export default function RoutePanel({ selectedRoute, onClose, onTapStop }: Props) {
  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 30, stiffness: 320 }}
      className="map-overlay-card absolute bottom-0 left-0 right-0 z-[1001]"
      style={{ maxHeight: "70vh" }}
    >
      <div
        className="bg-[#0a0f1c]/97 backdrop-blur-xl border-t border-white/[0.07] rounded-t-[18px] overflow-hidden flex flex-col"
        style={{ maxHeight: "70vh", boxShadow: "var(--shadow-sheet)" }}
      >
        <div className="flex justify-center pt-2.5 pb-1.5">
          <div className="w-9 h-[3px] rounded-full bg-white/15" />
        </div>

        <div className="px-4 pb-3 flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
               style={{ background: "rgba(240,160,32,0.15)", border: "1px solid rgba(240,160,32,0.3)" }}>
            <svg className="w-5 h-5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <polygon points="3 11 22 2 13 21 11 13 3 11"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-400">Ruta</p>
            <p className="text-sm text-white font-bold truncate">
              {selectedRoute.origin.name || "Origen"} → {selectedRoute.destination.name || "Destino"}
            </p>
            <p className="text-[11px] text-slate-500">
              {Math.max(1, Math.round(selectedRoute.route.totalSeconds / 60))} min ·{" "}
              {selectedRoute.route.numTransfers === 0 ? "directa" : `${selectedRoute.route.numTransfers} transbordo${selectedRoute.route.numTransfers > 1 ? "s" : ""}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/[0.06] flex items-center justify-center flex-shrink-0"
            aria-label="Cerrar ruta"
          >
            <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="px-4 overflow-y-auto flex-1 min-h-0"
             style={{ paddingBottom: "calc(24px + env(safe-area-inset-bottom))" }}>
          {selectedRoute.route.legs.map((leg, i) => {
            const minutes = Math.max(1, Math.round(leg.durationS / 60));
            if (leg.type === "walk") {
              const isLast = i === selectedRoute.route.legs.length - 1;
              return (
                <div key={i} className="flex items-center gap-3 py-3.5" style={{ borderBottom: "1px solid var(--border)" }}>
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "var(--surface)", color: "var(--text-2)" }}>
                    <Icons.Walk size={17} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold text-white">Caminá {minutes} min</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {leg.distanceM}m {isLast ? "hasta el destino" : leg.toStopName ? `hasta ${leg.toStopName}` : "hasta la parada"}
                    </p>
                  </div>
                </div>
              );
            }
            return (
              <BusLegRow
                key={i}
                lines={leg.lines || []}
                headsign={leg.headsign || ""}
                fromStopId={leg.fromStopId}
                fromStopName={leg.fromStopName}
                numStops={leg.numStops}
                minutes={minutes}
                onTapStop={onTapStop}
              />
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

// ─── BusLegRow ─────────────────────────────────────────────────────
// Fila del panel de ruta para un leg de bus, con ETA en vivo (FR-4.4).
function BusLegRow({
  lines, headsign, fromStopId, fromStopName, numStops, minutes, onTapStop,
}: {
  lines: string[];
  headsign: string;
  fromStopId?: string;
  fromStopName?: string;
  numStops?: number;
  minutes: number;
  onTapStop: (id: string) => void;
}) {
  const primary = lines[0] || "?";
  const { etaMin, realtime, loading } = useNextArrivalForLine(fromStopId, primary);

  // "Tomá el 64, 76 o 187" — múltiples alternativas como en Rutas.
  const linesLabel = lines.length === 0
    ? primary
    : lines.length === 1
      ? lines[0]
      : `${lines.slice(0, -1).join(", ")} o ${lines[lines.length - 1]}`;
  const dest = headsign.split(" ").slice(0, 4).join(" ");

  return (
    <button
      onClick={() => fromStopId && onTapStop(fromStopId)}
      className="w-full text-left flex items-center gap-3 py-3.5"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {(lines.length ? lines : [primary]).slice(0, 3).map((l) => (
          <LineBadge key={l} num={l} size="sm" />
        ))}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-semibold text-white truncate">
          Tomá el {linesLabel}{dest ? <span className="text-slate-400 font-normal"> · {dest}</span> : null}
        </p>
        <p className="text-xs text-slate-500 mt-0.5 truncate">
          {fromStopName} · {numStops} paradas · {minutes} min
        </p>
        {/* ETA EN VIVO */}
        {loading ? (
          <p className="text-[11px] text-slate-600 mt-1">Buscando próximo…</p>
        ) : etaMin !== null ? (
          <p className={`text-[11px] font-semibold mt-1 ${etaMin <= 3 ? "text-emerald-400" : "text-slate-300"}`}>
            {realtime ? "● " : "○ "}
            Próximo en {etaMin === 0 ? "<1" : etaMin} min{realtime ? "" : " (horario)"}
          </p>
        ) : (
          <p className="text-[11px] text-slate-600 mt-1">Sin próximos por ahora</p>
        )}
      </div>
      <svg className="w-4 h-4 text-slate-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </button>
  );
}
