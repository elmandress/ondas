"use client";

import { motion } from "framer-motion";
import type { Arrival } from "@/lib/stm";
import { lineColorFromCode } from "@/lib/stm";
import { walkToLeaveTime, leaveNowUrgency, formatEta } from "@/lib/utils";

interface LeaveNowHeroProps {
  arrivals: Arrival[];
  loading: boolean;
  walkMinutes: number;
  stopName?: string;
  onTap: () => void;
}

export default function LeaveNowHero({ arrivals, loading, walkMinutes, stopName, onTap }: LeaveNowHeroProps) {
  const first = arrivals[0];
  const leaveIn = first ? walkToLeaveTime(walkMinutes, first.eta) : 99;
  const urgency = leaveNowUrgency(leaveIn);

  if (loading && !arrivals.length) {
    return <div className="h-44 skeleton rounded-3xl" />;
  }

  if (!arrivals.length) {
    return (
      <div className="h-44 glass rounded-3xl flex flex-col items-center justify-center gap-2">
        <svg className="w-8 h-8 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <rect x="2" y="6" width="20" height="12" rx="2" />
          <path d="M22 10H2" />
        </svg>
        <p className="text-slate-500 text-sm">Sin buses en los próximos 30 min</p>
      </div>
    );
  }

  const gradients = {
    now:   "from-green-500/20 via-green-600/10 to-transparent border-green-500/30",
    soon:  "from-orange-500/20 via-orange-600/10 to-transparent border-orange-500/30",
    chill: "from-blue-600/15 via-blue-700/5 to-transparent border-blue-500/20",
  };
  const accents = {
    now:   { text: "text-green-400", glow: "shadow-green-500/30" },
    soon:  { text: "text-orange-400", glow: "shadow-orange-500/20" },
    chill: { text: "text-blue-400",   glow: "shadow-blue-500/20" },
  };
  const labels = {
    now:   "¡SALÍ AHORA!",
    soon:  "Salí en",
    chill: "Tenés tiempo",
  };

  return (
    <motion.button
      whileTap={{ scale: 0.985 }}
      onClick={onTap}
      className={`w-full rounded-3xl bg-gradient-to-br border p-5 text-left shadow-2xl ${gradients[urgency]}`}
    >
      {/* Fila superior: countdown + buses */}
      <div className="flex items-start justify-between mb-4">
        {/* Countdown */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
            {labels[urgency]}
          </p>
          {urgency === "now" ? (
            <p className={`text-4xl font-black ${accents[urgency].text} countdown-urgent`}>
              ¡YA!
            </p>
          ) : (
            <div className="flex items-end gap-1.5">
              <span className={`text-5xl font-black leading-none time-display ${accents[urgency].text} ${urgency === "soon" ? "countdown-urgent" : ""}`}>
                {leaveIn}
              </span>
              <span className={`text-base font-semibold mb-1.5 ${accents[urgency].text} opacity-70`}>min</span>
            </div>
          )}
        </div>

        {/* Próximos buses */}
        <div className="flex flex-col gap-1.5 items-end">
          {arrivals.slice(0, 3).map((a, i) => (
            <MiniArrivalChip key={i} arrival={a} primary={i === 0} />
          ))}
        </div>
      </div>

      {/* Pie: caminata + parada */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="5" r="1" />
            <path d="M9 20l3-9" /><path d="M13 13l2 4" /><path d="M7 20h3" /><path d="M16 20h-2" /><path d="M15 10l2-2-2-1" />
          </svg>
          <span>{walkMinutes} min caminando</span>
          {stopName && (
            <><span className="text-slate-700">·</span><span className="truncate max-w-[100px]">{stopName.split(" – ")[0]}</span></>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-600">
          <span>Ver todos</span>
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      </div>
    </motion.button>
  );
}

function MiniArrivalChip({ arrival, primary }: { arrival: Arrival; primary: boolean }) {
  const color = arrival.lineColor || lineColorFromCode(arrival.lineId);
  return (
    <div
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl ${primary ? "bg-white/10" : "bg-white/[0.04]"}`}
    >
      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
      <span className="text-xs font-bold text-white tracking-tight">{arrival.lineName}</span>
      <span className={`text-xs font-semibold tabular-nums ${primary ? "text-white" : "text-slate-400"}`}>
        {formatEta(arrival.eta)}
      </span>
      {arrival.realtime && (
        <div className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0 relative">
          <div className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-60" />
        </div>
      )}
    </div>
  );
}
