"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useArrivals } from "@/hooks/useArrivals";
import { lineColorFromId, formatEta, etaColorClass } from "@/lib/utils";
import type { BusStop } from "@/lib/stm";

const POPULAR: { name: string; stopId: string; code: string; lines: string[] }[] = [
  { name: "18 de Julio esq. Ejido", stopId: "stop_001", code: "4521", lines: ["103", "174", "D1"] },
  { name: "Tres Cruces Terminal", stopId: "s3", code: "3301", lines: ["D1", "20"] },
  { name: "Punta Carretas Shopping", stopId: "s2", code: "2201", lines: ["G", "H", "121"] },
  { name: "Ciudad Vieja - Plaza Indep.", stopId: "s4", code: "1101", lines: ["103", "174"] },
  { name: "Pocitos - Av. Brasil", stopId: "s5", code: "5501", lines: ["174", "G"] },
];

export default function SearchScreen() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BusStop[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedStop, setSelectedStop] = useState<{ id: string; name: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Búsqueda con debounce
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/stm/stops?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.stops || []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { arrivals, loading } = useArrivals(selectedStop?.id || null, 25000);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-14 pb-4 shrink-0">
        <h1 className="text-2xl font-bold text-white tracking-tight mb-4">Buscar paradas</h1>

        {/* Buscador */}
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="18 de Julio, Pocitos, #4521…"
            className="w-full glass rounded-2xl pl-11 pr-10 py-3.5 text-sm text-white placeholder:text-slate-500 focus:border-blue-500/50 focus:bg-blue-600/5 transition-all outline-none"
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button
              onClick={() => { setQuery(""); setResults([]); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-300"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Contenido scrollable */}
      <div className="flex-1 overflow-y-auto px-5 pb-6">
        <AnimatePresence mode="wait">
          {!query && !selectedStop && (
            <motion.div key="popular" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                Paradas frecuentes
              </p>
              <div className="space-y-2">
                {POPULAR.map((stop, i) => (
                  <motion.button
                    key={stop.stopId}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => setSelectedStop({ id: stop.stopId, name: stop.name })}
                    className="w-full glass rounded-2xl px-4 py-3.5 flex items-center gap-3 text-left tap-card"
                  >
                    <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-slate-400 shrink-0">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="6" width="20" height="12" rx="2" />
                        <path d="M22 10H2" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{stop.name}</p>
                      <p className="text-xs text-slate-500">#{stop.code}</p>
                    </div>
                    <div className="flex gap-1 flex-wrap justify-end max-w-[90px]">
                      {stop.lines.slice(0, 3).map((l) => (
                        <span key={l} className="text-[10px] font-bold px-1.5 py-0.5 rounded-md text-white" style={{ backgroundColor: lineColorFromId(l) + "40" }}>{l}</span>
                      ))}
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {query && !selectedStop && (
            <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {searching ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 skeleton rounded-2xl" />
                  ))}
                </div>
              ) : results.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-4xl mb-3">🔍</p>
                  <p className="text-slate-400 text-sm">No encontramos paradas con "{query}"</p>
                  <p className="text-slate-600 text-xs mt-1">Probá con el nombre del barrio o número de parada</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {results.map((stop, i) => (
                    <motion.button
                      key={stop.stopId}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      onClick={() => setSelectedStop({ id: stop.stopId, name: stop.stopName })}
                      className="w-full glass rounded-2xl px-4 py-3.5 flex items-center gap-3 text-left tap-card"
                    >
                      <div className="w-9 h-9 rounded-xl bg-blue-600/15 flex items-center justify-center text-blue-400 shrink-0">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="6" width="20" height="12" rx="2" />
                          <path d="M22 10H2" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{stop.stopName}</p>
                        <p className="text-xs text-slate-500">#{stop.stopCode}</p>
                      </div>
                      <svg className="w-4 h-4 text-slate-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </motion.button>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {selectedStop && (
            <motion.div key="detail" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {/* Botón volver */}
              <button
                onClick={() => setSelectedStop(null)}
                className="flex items-center gap-2 text-blue-400 text-sm font-medium mb-4"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                Volver
              </button>

              <div className="mb-4">
                <h2 className="text-xl font-bold text-white">{selectedStop.name}</h2>
                <p className="text-sm text-slate-400 mt-1">Próximas llegadas</p>
              </div>

              {loading && !arrivals.length ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-16 skeleton rounded-2xl" />
                  ))}
                </div>
              ) : arrivals.length === 0 ? (
                <div className="py-10 text-center text-slate-500 text-sm">
                  Sin buses en los próximos 30 minutos
                </div>
              ) : (
                <div className="space-y-2">
                  {arrivals.map((arrival, i) => {
                    const color = lineColorFromId(arrival.lineId);
                    return (
                      <motion.div
                        key={`${arrival.lineId}-${i}`}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-white/[0.04]"
                      >
                        <div
                          className="w-11 h-11 rounded-xl flex items-center justify-center font-black text-sm text-white shrink-0"
                          style={{ backgroundColor: color + "33", border: `1.5px solid ${color}60` }}
                        >
                          {arrival.lineName}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{arrival.destination}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {arrival.realtime ? (
                              <span className="flex items-center gap-1 text-[10px] text-green-400 font-medium">
                                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                                Tiempo real
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-500">Estimado</span>
                            )}
                          </div>
                        </div>
                        <p className={`text-xl font-black time-display shrink-0 ${etaColorClass(arrival.eta)}`}>
                          {formatEta(arrival.eta)}
                        </p>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
