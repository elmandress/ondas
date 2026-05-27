"use client";

import { motion } from "framer-motion";
import type { Arrival } from "@/lib/stm";
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
    return <div className="h-48 skeleton rounded-3xl" />;
  }

  if (!arrivals.length) {
    return (
      <div className="h-48 glass rounded-3xl flex flex-col items-center justify-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center">
          <svg className="w-6 h-6 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <rect x="2" y="4" width="20" height="14" rx="2" />
            <path d="M22 9H2" />
            <circle cx="7" cy="19" r="1.5" /><circle cx="17" cy="19" r="1.5" />
          </svg>
        </div>
        <p className="text-slate-500 text-sm">Sin servicios en los próximos 30 min</p>
      </div>
    );
  }

  const cfg = {
    now:   { bg: "from-emerald-500/20 via-emerald-600/8 to-transparent", border: "border-emerald-500/30", accent: "text-emerald-400", label: "¡SALÍ AHORA!", dot: "#34d399" },
    soon:  { bg: "from-amber-500/20 via-amber-600/8 to-transparent",   border: "border-amber-500/30",   accent: "text-amber-400",   label: "Salí en",       dot: "#fbbf24" },
    chill: { bg: "from-blue-500/12 via-blue-700/4 to-transparent",      border: "border-blue-500/20",    accent: "text-blue-400",    label: "Tenés tiempo",  dot: "#60a5fa" },
  }[urgency];

  return (
    <motion.button
      whileTap={{ scale: 0.985 }}
      onClick={onTap}
      className={`w-full rounded-3xl bg-gradient-to-br border ${cfg.bg} ${cfg.border} p-5 text-left shadow-2xl`}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Countdown */}
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 mb-2">
            {cfg.label}
          </p>
          {urgency === "now" ? (
            <p className={`text-5xl font-black ${cfg.accent} countdown-urgent leading-none`}>¡YA!</p>
          ) : (
            <div className="flex items-end gap-1.5">
              <span className={`text-6xl font-black leading-none time-display ${cfg.accent} ${urgency === "soon" ? "countdown-urgent" : ""}`}>
                {leaveIn}
              </span>
              <span className={`text-lg font-semibold mb-2 ${cfg.accent} opacity-60`}>min</span>
            </div>
          )}

          {/* Caminata + parada */}
          <div className="flex items-center gap-1.5 mt-3">
            <svg className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="5" r="1" />
              <path d="M9 20l3-9" /><path d="M13 13l2 4" /><path d="M7 20h3" /><path d="M16 20h-2" /><path d="M15 10l2-2-2-1" />
            </svg>
            <span className="text-xs text-slate-600">{walkMinutes} min</span>
            {stopName && (
              <>
                <span className="text-slate-700">·</span>
                <span className="text-xs text-slate-600 truncate max-w-[130px]">{stopName.split(" – ")[0]}</span>
              </>
            )}
          </div>
        </div>

        {/* Próximos buses */}
        <div className="flex flex-col gap-2 items-end flex-shrink-0">
          {arrivals.slice(0, 3).map((a, i) => (
            <NextBusChip key={i} arrival={a} primary={i === 0} dotColor={i === 0 ? cfg.dot : undefined} />
          ))}
          <div className="flex items-center gap-1 mt-1">
            <span className="text-[10px] text-slate-600">Ver todos</span>
            <svg className="w-3 h-3 text-slate-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        </div>
      </div>
    </motion.button>
  );
}

function NextBusChip({ arrival, primary, dotColor }: { arrival: Arrival; primary: boolean; dotColor?: string }) {
  return (
    <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl ${primary ? "bg-white/10 border border-white/10" : "bg-white/[0.04]"}`}>
      <span className="text-xs font-black text-white tracking-tight min-w-[28px] text-center">{arrival.lineName}</span>
      <div className="w-px h-3 bg-white/10" />
      <span className={`text-xs font-bold tabular-nums ${primary ? "text-white" : "text-slate-400"}`}>
        {formatEta(arrival.eta)}
      </span>
      {arrival.realtime && (
        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: dotColor || "#34d399" }}>
          <div className="w-full h-full rounded-full animate-ping" style={{ backgroundColor: dotColor || "#34d399", opacity: 0.5 }} />
        </div>
      )}
    </div>
  );
}
