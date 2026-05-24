"use client";

import { motion } from "framer-motion";
import { useArrivals } from "@/hooks/useArrivals";
import { STOPS_DATASET, lineColorFromCode } from "@/lib/stm";
import { formatEta, etaColorClass, formatTime } from "@/lib/utils";

interface StopArrivalSheetProps {
  stopId: string;
  onClose: () => void;
}

export default function StopArrivalSheet({ stopId, onClose }: StopArrivalSheetProps) {
  const stop = STOPS_DATASET.find((s) => s.stopId === stopId);
  const { arrivals, loading, lastUpdated, refetch } = useArrivals(stopId, 20000);

  return (
    <>
      {/* Overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
      />

      {/* Sheet */}
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 320 }}
        className="fixed bottom-0 left-0 right-0 z-50 max-w-md mx-auto"
        style={{ maxHeight: "88vh" }}
      >
        <div className="glass-dark rounded-t-[28px] border-t border-white/10 flex flex-col overflow-hidden" style={{ maxHeight: "88vh" }}>

          {/* Handle */}
          <div className="flex justify-center pt-3 pb-0 flex-shrink-0">
            <div className="w-9 h-1 rounded-full bg-white/20" />
          </div>

          {/* Header */}
          <div className="px-5 pt-3 pb-4 flex-shrink-0">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="6" width="20" height="12" rx="2" />
                  <path d="M22 10H2" />
                  <circle cx="7" cy="18" r="1.5" /><circle cx="17" cy="18" r="1.5" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-400">
                  Parada #{stop?.stopCode || stopId}
                </p>
                <h2 className="text-base font-bold text-white leading-tight mt-0.5">
                  {stop?.stopName || `Parada ${stopId}`}
                </h2>
                {lastUpdated && (
                  <p className="text-[10px] text-slate-600 mt-1">
                    Actualizado {formatTime(lastUpdated)}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={refetch}
                  className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center"
                >
                  <svg className={`w-4 h-4 text-slate-400 ${loading ? "animate-spin" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <polyline points="23 4 23 10 17 10" />
                    <polyline points="1 20 1 14 7 14" />
                    <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                  </svg>
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={onClose}
                  className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center"
                >
                  <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </motion.button>
              </div>
            </div>

            {/* Líneas disponibles */}
            {stop && (
              <div className="flex gap-1.5 flex-wrap mt-3">
                {stop.lines.map((l) => (
                  <span
                    key={l}
                    className="text-[10px] font-black px-2 py-1 rounded-lg text-white"
                    style={{ backgroundColor: lineColorFromCode(l) + "33", border: `1px solid ${lineColorFromCode(l)}55` }}
                  >
                    {l}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Divisor */}
          <div className="h-px bg-white/5 mx-5 flex-shrink-0" />

          {/* TABLERO DE LLEGADAS */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
            {loading && !arrivals.length ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 skeleton rounded-2xl" />
              ))
            ) : arrivals.length === 0 ? (
              <div className="py-12 flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center">
                  <svg className="w-7 h-7 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                    <rect x="2" y="6" width="20" height="12" rx="2" />
                    <path d="M22 10H2" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-slate-400 text-sm font-semibold">Sin buses próximamente</p>
                  <p className="text-slate-600 text-xs mt-1">No hay servicios en los próximos 30 min</p>
                </div>
              </div>
            ) : (
              <>
                {/* Indicador "ahora" para el primer bus */}
                {arrivals[0]?.eta <= 3 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-500/10 border border-green-500/20 mb-3"
                  >
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <p className="text-xs text-green-400 font-bold">Bus llegando — preparate para salir</p>
                  </motion.div>
                )}

                {arrivals.map((a, i) => (
                  <motion.div
                    key={`${a.lineId}-${i}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.035 }}
                  >
                    <ArrivalRow arrival={a} />
                  </motion.div>
                ))}

                <p className="text-center text-[10px] text-slate-700 pt-2 pb-1">
                  Mostrando próximos {arrivals.length} servicios
                </p>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
}

function OccupancyBars({ level }: { level?: string }) {
  if (!level) return null;
  const fill = level === "high" ? 3 : level === "medium" ? 2 : 1;
  const color = level === "high" ? "#ef4444" : level === "medium" ? "#f97316" : "#22c55e";
  return (
    <div className="flex gap-[2px] items-end" title={`Ocupación: ${level === "high" ? "Alta" : level === "medium" ? "Media" : "Baja"}`}>
      {[1, 2, 3].map((n) => (
        <div key={n} className="w-1 rounded-sm" style={{ height: n * 3 + 4, backgroundColor: n <= fill ? color : "rgba(255,255,255,0.08)" }} />
      ))}
    </div>
  );
}

function ArrivalRow({ arrival }: { arrival: import("@/lib/stm").Arrival }) {
  const color = arrival.lineColor || lineColorFromCode(arrival.lineId);
  const isUrgent = arrival.eta <= 2;
  const isSoon = arrival.eta <= 8;

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-colors ${
        isUrgent
          ? "bg-green-500/10 border border-green-500/25"
          : isSoon
          ? "bg-orange-500/5 border border-orange-500/10"
          : "bg-white/[0.035]"
      }`}
    >
      {/* Badge línea */}
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-sm text-white flex-shrink-0"
        style={{ backgroundColor: color + "2a", border: `2px solid ${color}55` }}
      >
        {arrival.lineName}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white truncate">{arrival.destination}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {arrival.realtime ? (
            <span className="flex items-center gap-1 text-[10px] text-green-400 font-semibold">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
              Tiempo real
            </span>
          ) : (
            <span className="text-[10px] text-slate-500 font-medium">Programado</span>
          )}
          {arrival.distance && (
            <span className="text-[10px] text-slate-600">{Math.round(arrival.distance)}m</span>
          )}
          <OccupancyBars level={arrival.occupancy} />
        </div>
      </div>

      {/* ETA */}
      <div className="flex-shrink-0 text-right">
        <p className={`text-2xl font-black time-display ${isUrgent ? "text-green-400 countdown-urgent" : etaColorClass(arrival.eta)}`}>
          {formatEta(arrival.eta)}
        </p>
      </div>
    </div>
  );
}
