"use client";

import { motion } from "framer-motion";
import type { Arrival } from "@/lib/stm";
import { walkToLeaveTime, leaveNowUrgency, formatEta, lineColorFromId } from "@/lib/utils";

interface LeaveNowCardProps {
  arrivals: Arrival[];
  walkMinutes: number;
  stopName?: string;
  onTap: () => void;
}

export default function LeaveNowCard({ arrivals, walkMinutes, stopName, onTap }: LeaveNowCardProps) {
  const [first, second, third] = arrivals;
  const leaveIn = walkToLeaveTime(walkMinutes, first?.eta ?? 99);
  const urgency = leaveNowUrgency(leaveIn);

  const bgMap = {
    now: "from-green-500/20 to-green-600/10 border-green-500/30",
    soon: "from-orange-500/20 to-orange-600/10 border-orange-500/30",
    chill: "from-blue-600/15 to-blue-700/5 border-blue-500/20",
  };

  const accentMap = {
    now: "text-green-400",
    soon: "text-orange-400",
    chill: "text-blue-400",
  };

  const labelMap = {
    now: "¡SALÍ AHORA!",
    soon: "Salí en",
    chill: "Podés salir en",
  };

  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onTap}
      className={`w-full rounded-3xl bg-gradient-to-br border p-5 text-left ${bgMap[urgency]}`}
    >
      {/* Línea superior */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">
            {labelMap[urgency]}
          </p>
          {urgency !== "now" ? (
            <div className="flex items-end gap-1">
              <span
                className={`text-5xl font-black leading-none time-display ${accentMap[urgency]} ${urgency === "soon" ? "countdown-urgent" : ""}`}
              >
                {leaveIn}
              </span>
              <span className={`text-lg font-semibold mb-1 ${accentMap[urgency]}`}>min</span>
            </div>
          ) : (
            <p className={`text-3xl font-black ${accentMap[urgency]} countdown-urgent`}>
              ¡Ya!
            </p>
          )}
        </div>

        {/* Bus indicator */}
        <div className="flex flex-col items-end gap-1.5">
          {first && (
            <BusChip arrival={first} highlight />
          )}
          {second && (
            <BusChip arrival={second} />
          )}
        </div>
      </div>

      {/* Pie: caminata + próximo bus */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <WalkIcon className="w-3.5 h-3.5" />
          <span>{walkMinutes} min caminando</span>
          {stopName && (
            <>
              <span className="text-slate-600">·</span>
              <span className="truncate max-w-[110px]">{stopName}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 text-xs text-slate-500">
          <span>Ver todos</span>
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      </div>

      {/* Barra de progreso urgency */}
      {urgency !== "chill" && (
        <motion.div
          className="mt-3 h-0.5 rounded-full bg-white/5 overflow-hidden"
        >
          <motion.div
            className={`h-full rounded-full ${urgency === "now" ? "bg-green-400" : "bg-orange-400"}`}
            animate={{ width: urgency === "now" ? "100%" : `${Math.max(10, 100 - leaveIn * 8)}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </motion.div>
      )}
    </motion.button>
  );
}

function BusChip({ arrival, highlight }: { arrival: Arrival; highlight?: boolean }) {
  const color = arrival.lineColor || lineColorFromId(arrival.lineId);
  return (
    <div
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl ${highlight ? "bg-white/10" : "bg-white/5"}`}
    >
      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-xs font-bold text-white">{arrival.lineName}</span>
      <span className="text-xs font-semibold" style={{ color: highlight ? "#fff" : "#94a3b8" }}>
        {formatEta(arrival.eta)}
      </span>
      {arrival.realtime && (
        <div className="w-1.5 h-1.5 rounded-full bg-green-400 relative">
          <div className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-50" />
        </div>
      )}
    </div>
  );
}

function WalkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="1" />
      <path d="M9 20l3-9 2 5 2-3" />
      <path d="M7 20h3m5 0h-3" />
      <path d="M15 10l2-2-2-1" />
    </svg>
  );
}
