"use client";

import { motion } from "framer-motion";
import { useArrivals } from "@/hooks/useArrivals";
import { formatEta, etaColorClass, lineColorFromId } from "@/lib/utils";
import type { FavoriteRoute } from "@/lib/store";

interface FavoriteCardProps {
  route: FavoriteRoute;
  onTap: () => void;
}

export default function FavoriteCard({ route, onTap }: FavoriteCardProps) {
  const { arrivals, loading } = useArrivals(route.fromStop, 30000);
  const next = arrivals[0];

  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onTap}
      className="w-full glass rounded-2xl px-4 py-3.5 flex items-center gap-3 text-left tap-card"
    >
      {/* Emoji */}
      <span className="text-2xl shrink-0">{route.emoji}</span>

      {/* Info ruta */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{route.name}</p>
        <p className="text-xs text-slate-500 truncate">{route.fromName}</p>

        {/* Líneas */}
        <div className="flex gap-1 mt-1.5 flex-wrap">
          {route.lines.slice(0, 4).map((line) => (
            <span
              key={line}
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-md text-white"
              style={{ backgroundColor: lineColorFromId(line) + "55", border: `1px solid ${lineColorFromId(line)}66` }}
            >
              {line}
            </span>
          ))}
        </div>
      </div>

      {/* ETA */}
      <div className="shrink-0 text-right">
        {loading ? (
          <div className="w-12 h-8 skeleton rounded-lg" />
        ) : next ? (
          <>
            <p className={`text-xl font-black time-display ${etaColorClass(next.eta)}`}>
              {formatEta(next.eta)}
            </p>
            {next.realtime && (
              <div className="flex items-center gap-1 justify-end mt-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 relative">
                  <div className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-60" />
                </div>
                <span className="text-[10px] text-green-400">En vivo</span>
              </div>
            )}
          </>
        ) : (
          <p className="text-xs text-slate-500">Sin datos</p>
        )}
      </div>
    </motion.button>
  );
}
