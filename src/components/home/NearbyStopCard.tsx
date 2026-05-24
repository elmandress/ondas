"use client";

import { motion } from "framer-motion";
import { lineColorFromId } from "@/lib/utils";
import type { BusStop } from "@/lib/stm";

interface NearbyStopCardProps {
  stop: BusStop;
  isActive: boolean;
  onTap: () => void;
}

export default function NearbyStopCard({ stop, isActive, onTap }: NearbyStopCardProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onTap}
      className={`w-full rounded-2xl px-4 py-3.5 flex items-center gap-3 text-left transition-colors ${
        isActive
          ? "bg-blue-600/15 border border-blue-500/25"
          : "glass"
      }`}
    >
      {/* Icono parada */}
      <div
        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
          isActive ? "bg-blue-600/30" : "bg-white/5"
        }`}
      >
        <svg className={`w-4 h-4 ${isActive ? "text-blue-400" : "text-slate-400"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="6" width="20" height="12" rx="2" />
          <path d="M12 12h.01" />
          <path d="M7 12h.01" />
          <path d="M17 12h.01" />
          <path d="M22 10H2" />
        </svg>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold truncate ${isActive ? "text-blue-200" : "text-white"}`}>
          {stop.stopName}
        </p>
        <p className="text-xs text-slate-500">Parada #{stop.stopCode}</p>
      </div>

      {/* Líneas badge */}
      <div className="flex gap-1 flex-wrap justify-end max-w-[100px]">
        {stop.lines.slice(0, 3).map((line) => (
          <span
            key={line}
            className="text-[10px] font-bold px-1.5 py-0.5 rounded-md text-white shrink-0"
            style={{ backgroundColor: lineColorFromId(line) + "40" }}
          >
            {line}
          </span>
        ))}
        {stop.lines.length > 3 && (
          <span className="text-[10px] text-slate-500">+{stop.lines.length - 3}</span>
        )}
      </div>
    </motion.button>
  );
}
