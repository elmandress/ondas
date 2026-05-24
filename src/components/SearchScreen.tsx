"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { STOPS_DATASET, lineColorFromCode } from "@/lib/stm";
import type { BusStop } from "@/lib/stm";
import { searchStops } from "@/lib/stm";
import StopArrivalSheet from "@/components/home/StopArrivalSheet";

// Paradas más visitadas en Montevideo
const TRENDING_STOPS = [
  "4521", // 18 de Julio esq. Ejido
  "3301", // Tres Cruces
  "2201", // Punta Carretas
  "1101", // Ciudad Vieja
  "5501", // Pocitos
].map((id) => STOPS_DATASET.find((s) => s.stopId === id)).filter(Boolean) as BusStop[];

export default function SearchScreen() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BusStop[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [history, setHistory] = useState<BusStop[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cargar historial desde localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("ondas_stop_history");
      if (raw) {
        const ids: string[] = JSON.parse(raw);
        const stops = ids.map((id) => STOPS_DATASET.find((s) => s.stopId === id)).filter(Boolean) as BusStop[];
        setHistory(stops.slice(0, 4));
      }
    } catch {}
  }, []);

  // Búsqueda con debounce
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      const found = searchStops(query);
      setResults(found);
      setSearching(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  // Focus automático al montar
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 200);
  }, []);

  function handleSelectStop(stopId: string) {
    setSelectedStopId(stopId);
    // Guardar en historial
    try {
      const raw = localStorage.getItem("ondas_stop_history");
      const ids: string[] = raw ? JSON.parse(raw) : [];
      const updated = [stopId, ...ids.filter((id) => id !== stopId)].slice(0, 6);
      localStorage.setItem("ondas_stop_history", JSON.stringify(updated));
    } catch {}
  }

  const showHistory = !query.trim() && history.length > 0;
  const showTrending = !query.trim();
  const showResults = query.trim().length > 0;

  return (
    <div className="flex flex-col h-full">

      {/* ── HEADER ── */}
      <div className="px-5 pt-14 pb-4 flex-shrink-0">
        <h1 className="text-2xl font-black text-white tracking-tight mb-4">Buscar</h1>

        {/* Campo de búsqueda */}
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
            <svg className="w-4 h-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Parada, barrio, línea… (ej: 103, Pocitos)"
            className="w-full glass rounded-2xl pl-11 pr-10 py-3.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-blue-500/40 focus:bg-blue-600/5 transition-all border border-transparent"
            autoComplete="off"
            spellCheck={false}
            inputMode="search"
          />
          <AnimatePresence>
            {query && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center"
              >
                <svg className="w-3 h-3 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── CONTENIDO SCROLLABLE ── */}
      <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-5">

        <AnimatePresence mode="wait">

          {/* ── RESULTADOS DE BÚSQUEDA ── */}
          {showResults && (
            <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {searching ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <div key={i} className="h-16 skeleton rounded-2xl" />)}
                </div>
              ) : results.length === 0 ? (
                <div className="py-16 flex flex-col items-center gap-3">
                  <div className="text-5xl">🔍</div>
                  <p className="text-slate-400 text-sm font-semibold">Sin resultados para "{query}"</p>
                  <p className="text-slate-600 text-xs text-center max-w-[200px]">
                    Probá con el número de parada, nombre del barrio o número de línea
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                    {results.length} resultado{results.length !== 1 ? "s" : ""}
                  </p>
                  {results.map((stop, i) => (
                    <motion.div
                      key={stop.stopId}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                    >
                      <StopRow stop={stop} onTap={() => handleSelectStop(stop.stopId)} />
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ── DEFAULT: HISTORIAL + FRECUENTES ── */}
          {!showResults && (
            <motion.div key="default" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">

              {/* Historial reciente */}
              {showHistory && (
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Recientes</p>
                    <button
                      onClick={() => {
                        setHistory([]);
                        localStorage.removeItem("ondas_stop_history");
                      }}
                      className="text-[10px] text-slate-600 font-medium"
                    >
                      Borrar
                    </button>
                  </div>
                  <div className="space-y-2">
                    {history.map((stop, i) => (
                      <motion.div key={stop.stopId} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                        <StopRow stop={stop} onTap={() => handleSelectStop(stop.stopId)} isHistory />
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Paradas populares */}
              {showTrending && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2.5">
                    Paradas populares
                  </p>
                  <div className="space-y-2">
                    {TRENDING_STOPS.map((stop, i) => (
                      <motion.div
                        key={stop.stopId}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                      >
                        <StopRow stop={stop} onTap={() => handleSelectStop(stop.stopId)} />
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Explorar todas */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2.5">
                  Todas las paradas ({STOPS_DATASET.length})
                </p>
                <div className="space-y-2">
                  {STOPS_DATASET.slice(0, 8).map((stop, i) => (
                    <motion.div
                      key={stop.stopId}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 + i * 0.04 }}
                    >
                      <StopRow stop={stop} onTap={() => handleSelectStop(stop.stopId)} />
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* ── SHEET DE LLEGADAS ── */}
      <AnimatePresence>
        {selectedStopId && (
          <StopArrivalSheet
            stopId={selectedStopId}
            onClose={() => setSelectedStopId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── StopRow ──────────────────────────────────────────────────
function StopRow({ stop, onTap, isHistory }: { stop: BusStop; onTap: () => void; isHistory?: boolean }) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onTap}
      className="w-full glass rounded-2xl px-4 py-3.5 flex items-center gap-3 text-left"
    >
      {/* Icono */}
      <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
        {isHistory ? (
          <svg className="w-4 h-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        ) : (
          <svg className="w-4 h-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="6" width="20" height="12" rx="2" />
            <path d="M22 10H2" />
            <circle cx="7" cy="18" r="1.5" /><circle cx="17" cy="18" r="1.5" />
          </svg>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{stop.stopName}</p>
        <p className="text-[10px] text-slate-600 mt-0.5">#{stop.stopCode}</p>
        <div className="flex gap-1 mt-1.5 flex-wrap">
          {stop.lines.slice(0, 5).map((l) => (
            <span
              key={l}
              className="text-[9px] font-bold px-1.5 py-0.5 rounded-md text-white"
              style={{ backgroundColor: lineColorFromCode(l) + "40" }}
            >
              {l}
            </span>
          ))}
          {stop.lines.length > 5 && (
            <span className="text-[9px] text-slate-600">+{stop.lines.length - 5}</span>
          )}
        </div>
      </div>

      {/* Flecha */}
      <svg className="w-4 h-4 text-slate-700 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </motion.button>
  );
}
