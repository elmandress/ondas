"use client";

import { motion } from "framer-motion";
import type { Arrival } from "@/lib/stm";
import { formatEta, etaColorClass, formatTime } from "@/lib/utils";
import { lineColorFromCode } from "@/lib/stm";

interface ArrivalSheetProps {
  stopName: string;
  arrivals: Arrival[];
  loading: boolean;
  lastUpdated: Date | null;
  onClose: () => void;
  onRefresh: () => void;
}

export default function ArrivalSheet({
  stopName,
  arrivals,
  loading,
  lastUpdated,
  onClose,
  onRefresh,
}: ArrivalSheetProps) {
  return (
    <>
      {/* Overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
      />

      {/* Sheet */}
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-50 max-w-md mx-auto"
      >
        <div className="glass-dark rounded-t-3xl border-t border-white/10 overflow-hidden">
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-white/20" />
          </div>

          {/* Header */}
          <div className="px-5 pt-2 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">
                  Próximas llegadas
                </p>
                <h3 className="text-lg font-bold text-white leading-tight">{stopName}</h3>
                {lastUpdated && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    Actualizado {formatTime(lastUpdated)}
                  </p>
                )}
              </div>
              <button
                onClick={onRefresh}
                className="p-2 rounded-xl bg-white/5 active:bg-white/10"
                aria-label="Actualizar"
              >
                <svg className={`w-4 h-4 text-slate-400 ${loading ? "animate-spin" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10" />
                  <polyline points="1 20 1 14 7 14" />
                  <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                </svg>
              </button>
            </div>
          </div>

          {/* Lista de llegadas */}
          <div className="px-5 pb-8 space-y-2 max-h-[55vh] overflow-y-auto">
            {loading && !arrivals.length ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 skeleton rounded-2xl" />
              ))
            ) : arrivals.length === 0 ? (
              <div className="py-10 text-center text-slate-500 text-sm">
                Sin buses en los próximos 30 minutos
              </div>
            ) : (
              arrivals.map((arrival, i) => (
                <motion.div
                  key={`${arrival.lineId}-${i}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <ArrivalRow arrival={arrival} />
                </motion.div>
              ))
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
}

function OccupancyIcon({ level }: { level?: string }) {
  const fill = level === "high" ? 3 : level === "medium" ? 2 : 1;
  return (
    <div className="flex gap-0.5 items-end">
      {[1, 2, 3].map((n) => (
        <div
          key={n}
          className="w-1 rounded-sm"
          style={{
            height: n * 4 + 4,
            backgroundColor: n <= fill ? (level === "high" ? "#ef4444" : level === "medium" ? "#f97316" : "#22c55e") : "#1e293b",
          }}
        />
      ))}
    </div>
  );
}

function ArrivalRow({ arrival }: { arrival: Arrival }) {
  const color = arrival.lineColor || lineColorFromCode(arrival.lineId);
  const isUrgent = arrival.eta <= 2;

  return (
    <div className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl ${isUrgent ? "bg-green-500/10 border border-green-500/20" : "bg-white/[0.04]"}`}>
      {/* Color indicator + número de línea */}
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 font-black text-sm text-white"
        style={{ backgroundColor: color + "33", border: `1.5px solid ${color}60` }}
      >
        {arrival.lineName}
      </div>

      {/* Destino */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{arrival.destination}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {arrival.realtime ? (
            <span className="flex items-center gap-1 text-[10px] text-green-400 font-medium">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Tiempo real
            </span>
          ) : (
            <span className="text-[10px] text-slate-500">Estimado</span>
          )}
          {arrival.occupancy && (
            <OccupancyIcon level={arrival.occupancy} />
          )}
        </div>
      </div>

      {/* ETA */}
      <div className="shrink-0 text-right">
        <p className={`text-xl font-black time-display ${isUrgent ? "text-green-400 countdown-urgent" : etaColorClass(arrival.eta)}`}>
          {formatEta(arrival.eta)}
        </p>
      </div>
    </div>
  );
}
