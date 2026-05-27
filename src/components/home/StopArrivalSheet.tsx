"use client";

import { motion } from "framer-motion";
import { useArrivals } from "@/hooks/useArrivals";
import { useStopInfo } from "@/hooks/useStopInfo";
import { STOPS_DATASET } from "@/lib/stm";
import { formatEta, etaColorClass, formatTime } from "@/lib/utils";
import { useFavoriteStops, toggleFavoriteStop } from "@/lib/favorite-stops";

interface StopArrivalSheetProps {
  stopId: string;
  onClose: () => void;
}

export default function StopArrivalSheet({ stopId, onClose }: StopArrivalSheetProps) {
  const stop = STOPS_DATASET.find((s) => s.stopId === stopId);
  const { info } = useStopInfo(stopId);
  const { arrivals, loading, lastUpdated, refetch } = useArrivals(stopId, 20000);
  // Líneas REALES de la API (no las del shapefile que están desactualizadas)
  const realLines = info?.variants.map((v) => v.lineCode) || stop?.lines || [];

  // Favoritos reactivos
  const favorites = useFavoriteStops();
  const isFav = favorites.some((f) => f.stopId === stopId);
  const handleToggleFav = () => {
    if (!stop) return;
    toggleFavoriteStop({
      stopId: stop.stopId,
      stopCode: stop.stopCode,
      stopName: stop.stopName,
      lines: realLines.length > 0 ? realLines : stop.lines,
    });
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-[6px] z-40"
      />

      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 32, stiffness: 340 }}
        className="fixed bottom-0 left-0 right-0 z-50 max-w-md mx-auto"
        style={{ maxHeight: "88vh" }}
      >
        <div className="flex flex-col overflow-hidden rounded-t-[28px] border-t border-white/[0.07]" style={{ background: "rgba(8,13,26,0.97)", backdropFilter: "blur(32px)", maxHeight: "88vh" }}>

          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
            <div className="w-8 h-[3px] rounded-full bg-white/15" />
          </div>

          {/* Header */}
          <div className="px-5 pt-2 pb-3 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.25)" }}>
                <svg className="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="14" rx="2" />
                  <path d="M22 9H2" />
                  <circle cx="7" cy="19" r="1.5" /><circle cx="17" cy="19" r="1.5" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[9px] font-black uppercase tracking-[0.15em] text-blue-500">
                  Parada #{stop?.stopCode || stopId}
                </p>
                <h2 className="text-[15px] font-bold text-white leading-tight mt-0.5 truncate pr-2">
                  {stop?.stopName || `Parada ${stopId}`}
                </h2>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={handleToggleFav}
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: isFav ? "rgba(251,191,36,0.18)" : "rgba(255,255,255,0.05)" }}
                  aria-label={isFav ? "Quitar de favoritos" : "Agregar a favoritos"}
                >
                  <svg
                    className={`w-4 h-4 ${isFav ? "text-amber-400" : "text-slate-400"}`}
                    viewBox="0 0 24 24"
                    fill={isFav ? "currentColor" : "none"}
                    stroke="currentColor"
                    strokeWidth={2.2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                </button>
                <button
                  onClick={refetch}
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: "rgba(255,255,255,0.05)" }}
                >
                  <svg className={`w-4 h-4 text-slate-400 ${loading ? "animate-spin" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <polyline points="23 4 23 10 17 10" />
                    <polyline points="1 20 1 14 7 14" />
                    <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                  </svg>
                </button>
                <button
                  onClick={onClose}
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: "rgba(255,255,255,0.05)" }}
                >
                  <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Line chips — usar líneas REALES de la API */}
            {realLines.length > 0 && (
              <div className="flex gap-1.5 flex-wrap mt-3 max-h-14 overflow-hidden">
                {realLines.slice(0, 12).map((l) => (
                  <span
                    key={l}
                    className="text-[10px] font-black px-2 py-0.5 rounded-md text-slate-300"
                    style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}
                  >
                    {l}
                  </span>
                ))}
                {realLines.length > 12 && (
                  <span className="text-[10px] text-slate-600 self-center">+{realLines.length - 12}</span>
                )}
              </div>
            )}

            {lastUpdated && (
              <p className="text-[9px] text-slate-700 mt-2">Actualizado {formatTime(lastUpdated)}</p>
            )}
          </div>

          <div className="h-px mx-5 flex-shrink-0" style={{ background: "rgba(255,255,255,0.05)" }} />

          {/* Arrivals list */}
          <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
            {loading && !arrivals.length ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-[66px] skeleton rounded-2xl" />
              ))
            ) : arrivals.length === 0 ? (
              <div className="py-12 flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.04)" }}>
                  <svg className="w-7 h-7 text-slate-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                    <rect x="2" y="4" width="20" height="14" rx="2" />
                    <path d="M22 9H2" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-slate-400 text-sm font-semibold">Sin buses próximamente</p>
                  <p className="text-slate-600 text-xs mt-1">No hay servicios en los próximos 30 min</p>
                </div>
              </div>
            ) : (
              <>
                {arrivals[0]?.eta <= 3 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl mb-1"
                    style={{ background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.2)" }}
                  >
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <p className="text-xs text-emerald-400 font-bold">Bus llegando — preparate para salir</p>
                  </motion.div>
                )}

                {arrivals.map((a, i) => (
                  <motion.div
                    key={`${a.lineId}-${i}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <ArrivalRow arrival={a} />
                  </motion.div>
                ))}

                <p className="text-center text-[9px] text-slate-700 pt-2 pb-1">
                  {arrivals.length} próximos servicios
                </p>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
}

function ArrivalRow({ arrival }: { arrival: import("@/lib/stm").Arrival }) {
  const isUrgent = arrival.eta <= 2;
  const isSoon = arrival.eta <= 8;

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl`}
      style={{
        background: isUrgent ? "rgba(52,211,153,0.08)" : isSoon ? "rgba(251,191,36,0.05)" : "rgba(255,255,255,0.03)",
        border: isUrgent ? "1px solid rgba(52,211,153,0.2)" : isSoon ? "1px solid rgba(251,191,36,0.1)" : "1px solid rgba(255,255,255,0.04)",
      }}
    >
      {/* Unified line badge */}
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-sm text-white flex-shrink-0"
        style={{ background: "rgba(255,255,255,0.07)", border: "1.5px solid rgba(255,255,255,0.12)" }}
      >
        {arrival.lineName}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white truncate">{arrival.destination}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {arrival.realtime ? (
            <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
              En vivo
            </span>
          ) : arrival.isScheduled ? (
            <span className="text-[9px] bg-indigo-500/15 text-indigo-400 px-1.5 py-0.5 rounded font-bold">Horario</span>
          ) : (
            <span className="text-[10px] text-slate-600 font-medium">Estimado</span>
          )}
          {arrival.isShortened && (
            <span className="text-[9px] bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded font-bold">Acortado</span>
          )}
          {/* SRS FR-6.3: accesibilidad REAL (dato oficial API IM) */}
          {(arrival.access === "PISO BAJO" || arrival.access === "PLATAFORMA ELEVADORA") && (
            <span className="text-[9px] bg-sky-500/15 text-sky-400 px-1.5 py-0.5 rounded font-bold" title={arrival.access}>♿ Accesible</span>
          )}
          {arrival.thermalConfort === "Aire Acondicionado" && (
            <span className="text-[9px] bg-cyan-500/15 text-cyan-400 px-1.5 py-0.5 rounded font-bold" title="Aire acondicionado">❄ AC</span>
          )}
          {arrival.remainingStops !== undefined && arrival.remainingStops > 0 && (
            <span className="text-[10px] text-slate-500" title="Paradas que le faltan al bus">
              · a {arrival.remainingStops} paradas
            </span>
          )}
          {!arrival.remainingStops && arrival.distance && arrival.distance > 0 && (
            <span className="text-[10px] text-slate-700">{(arrival.distance / 1000).toFixed(1)}km</span>
          )}
        </div>
      </div>

      <div className="flex-shrink-0 text-right">
        <p className={`text-2xl font-black time-display ${isUrgent ? "text-emerald-400 countdown-urgent" : etaColorClass(arrival.eta)}`}>
          {formatEta(arrival.eta)}
        </p>
      </div>
    </div>
  );
}
