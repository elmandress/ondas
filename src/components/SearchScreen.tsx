"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { STOPS_DATASET, lineColorFromCode, searchStops, type BusStop } from "@/lib/stm";
import { useStopsDataset } from "@/hooks/useStopsDataset";
import StopArrivalSheet from "@/components/home/StopArrivalSheet";
import { setSelectedPlace } from "@/lib/selected-place";
import { setActiveTab } from "@/lib/active-tab";

interface GeoResult {
  // string para POIs curados ("osm:way:123"), number para resultados de Nominatim
  id: string | number;
  name: string;
  fullName: string;
  lat: number;
  lon: number;
  type: string;
  class?: string;
  icon?: string;
  source?: "curated" | "nominatim";
}

// Paradas top para mostrar por defecto (códigos de paradas populares)
const TRENDING_IDS = ["4521", "3301", "3302", "2201", "5501", "1101", "9001", "3003", "7703", "1900"];

type SearchMode = "idle" | "searching" | "stops" | "places" | "empty";

export default function SearchScreen() {
  const { ready: stopsReady } = useStopsDataset();
  const [query, setQuery] = useState("");
  const [stopResults, setStopResults] = useState<BusStop[]>([]);
  const [placeResults, setPlaceResults] = useState<GeoResult[]>([]);
  const [mode, setMode] = useState<SearchMode>("idle");
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [history, setHistory] = useState<BusStop[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Trending stops (se calcula cuando el dataset está listo)
  const trendingStops = useMemo<BusStop[]>(() => {
    if (!stopsReady) return [];
    return TRENDING_IDS
      .map((id) => STOPS_DATASET.find((s) => s.stopId === id))
      .filter(Boolean) as BusStop[];
  }, [stopsReady]);

  // Cargar historial cuando dataset esté listo
  useEffect(() => {
    if (!stopsReady) return;
    try {
      const raw = localStorage.getItem("ondas_stop_history");
      if (raw) {
        const ids: string[] = JSON.parse(raw);
        setHistory(ids.map((id) => STOPS_DATASET.find((s) => s.stopId === id)).filter(Boolean) as BusStop[]);
      }
    } catch {}
    setTimeout(() => inputRef.current?.focus(), 300);
  }, [stopsReady]);

  // Búsqueda con debounce — paradas locales + lugares via Nominatim
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const q = query.trim();
    if (!q) {
      setMode("idle");
      setStopResults([]);
      setPlaceResults([]);
      return;
    }

    setMode("searching");

    debounceRef.current = setTimeout(async () => {
      // Búsqueda de paradas local (instantánea)
      const localStops = searchStops(q);

      // Búsqueda de lugares via proxy Nominatim
      let places: GeoResult[] = [];
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        places = data.results || [];
      } catch {}

      setStopResults(localStops);
      setPlaceResults(places);

      if (localStops.length === 0 && places.length === 0) {
        setMode("empty");
      } else if (localStops.length > 0 && places.length === 0) {
        setMode("stops");
      } else {
        setMode("places");
      }
    }, 320);
  }, [query]);

  function handleSelectStop(stopId: string) {
    setSelectedStopId(stopId);
    try {
      const raw = localStorage.getItem("ondas_stop_history");
      const ids: string[] = raw ? JSON.parse(raw) : [];
      const updated = [stopId, ...ids.filter((id) => id !== stopId)].slice(0, 6);
      localStorage.setItem("ondas_stop_history", JSON.stringify(updated));
      setHistory(updated.map((id) => STOPS_DATASET.find((s) => s.stopId === id)).filter(Boolean) as BusStop[]);
    } catch {}
  }

  function handleSelectPlace(place: GeoResult) {
    // SRS FR-3.8: navegar al mapa con el lugar pineado.
    // El mapa abre un sheet con paradas cercanas + sus llegadas en vivo.
    setSelectedPlace({
      id: place.id,
      name: place.name,
      fullName: place.fullName,
      lat: place.lat,
      lon: place.lon,
      icon: place.icon,
      category: place.class || place.type,
    });
    setActiveTab("map");
  }

  const showIdle = mode === "idle";
  const showSearch = mode !== "idle";

  return (
    <div className="flex flex-col h-full">

      {/* ── HEADER ── */}
      <div className="px-5 pt-14 pb-4 flex-shrink-0">
        <h1 className="text-2xl font-black text-white tracking-tight mb-4">Buscar</h1>

        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
            <svg className="w-4 h-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nuevo Centro, Isla de Gorriti, línea 103…"
            className="w-full glass rounded-2xl pl-11 pr-10 py-3.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-blue-500/40 transition-all border border-transparent"
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

      {/* ── CONTENIDO ── */}
      <div className="flex-1 overflow-y-auto px-5 pb-6">
        <AnimatePresence mode="wait">

          {/* ── SPINNER ── */}
          {mode === "searching" && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-3 py-4">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
              <p className="text-slate-500 text-sm">Buscando…</p>
            </motion.div>
          )}

          {/* ── SIN RESULTADOS ── */}
          {mode === "empty" && (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="py-16 flex flex-col items-center gap-3">
              <div className="text-5xl">🔍</div>
              <p className="text-slate-400 text-sm font-semibold">Sin resultados para "{query}"</p>
              <p className="text-slate-600 text-xs text-center max-w-[220px]">Probá con otro nombre, dirección o número de línea</p>
            </motion.div>
          )}

          {/* ── RESULTADOS DE BÚSQUEDA ── */}
          {/* SRS FR-3.7: Lugares ANTES que paradas. Cuando el usuario busca "nuevo centro"
              o "facultad" quiere el lugar, no una parada. Las paradas son el medio. */}
          {(mode === "stops" || mode === "places") && (
            <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">

              {/* Lugares geográficos (primero) */}
              {placeResults.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2.5">
                    Lugares ({placeResults.length})
                  </p>
                  <div className="space-y-2">
                    {placeResults.map((place, i) => (
                      <motion.div key={place.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.035 }}>
                        <PlaceRow place={place} onTap={() => handleSelectPlace(place)} />
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Paradas STM (después) */}
              {stopResults.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2.5">
                    Paradas ({stopResults.length})
                  </p>
                  <div className="space-y-2">
                    {stopResults.map((stop, i) => (
                      <motion.div key={stop.stopId} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.035 }}>
                        <StopRow stop={stop} onTap={() => handleSelectStop(stop.stopId)} />
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

            </motion.div>
          )}

          {/* ── ESTADO INICIAL (sin query) ── */}
          {showIdle && (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">

              {/* Historial */}
              {history.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Recientes</p>
                    <button
                      onClick={() => { setHistory([]); localStorage.removeItem("ondas_stop_history"); }}
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

              {/* Populares */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2.5">Paradas populares</p>
                <div className="space-y-2">
                  {trendingStops.map((stop, i) => (
                    <motion.div key={stop.stopId} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                      <StopRow stop={stop} onTap={() => handleSelectStop(stop.stopId)} />
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Todas */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2.5">
                  Todas las paradas ({STOPS_DATASET.length})
                </p>
                <div className="space-y-2">
                  {STOPS_DATASET.slice(0, 10).map((stop, i) => (
                    <motion.div key={stop.stopId} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.035 }}>
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

// ── StopRow ──────────────────────────────────────────────────────
function StopRow({ stop, onTap, isHistory, distanceM }: {
  stop: BusStop;
  onTap: () => void;
  isHistory?: boolean;
  distanceM?: number;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onTap}
      className="w-full glass rounded-2xl px-4 py-3.5 flex items-center gap-3 text-left"
    >
      <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
        {isHistory ? (
          <svg className="w-4 h-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
        ) : (
          <svg className="w-4 h-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="6" width="20" height="12" rx="2"/>
            <path d="M22 10H2"/>
            <circle cx="7" cy="18" r="1.5"/><circle cx="17" cy="18" r="1.5"/>
          </svg>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{stop.stopName}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-[10px] text-slate-600">#{stop.stopCode}</p>
          {distanceM !== undefined && (
            <p className="text-[10px] text-blue-400 font-medium">
              {distanceM < 1000 ? `${distanceM}m` : `${(distanceM / 1000).toFixed(1)}km`}
            </p>
          )}
        </div>
        <div className="flex gap-1 mt-1.5 flex-wrap">
          {stop.lines.slice(0, 6).map((l) => (
            <span key={l} className="text-[9px] font-bold px-1.5 py-0.5 rounded-md text-white" style={{ backgroundColor: lineColorFromCode(l) + "40" }}>{l}</span>
          ))}
          {stop.lines.length > 6 && <span className="text-[9px] text-slate-600">+{stop.lines.length - 6}</span>}
        </div>
      </div>
      <svg className="w-4 h-4 text-slate-700 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </motion.button>
  );
}

// ── PlaceRow ─────────────────────────────────────────────────────
function PlaceRow({ place, onTap }: { place: GeoResult; onTap: () => void }) {
  const icon = place.icon || "📍";
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onTap}
      className="w-full glass rounded-2xl px-4 py-3.5 flex items-center gap-3 text-left"
    >
      <div className="w-9 h-9 rounded-xl bg-blue-600/10 flex items-center justify-center flex-shrink-0 text-lg">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{place.name}</p>
        <p className="text-[10px] text-slate-600 truncate mt-0.5">{place.fullName.split(",").slice(0, 3).join(",")}</p>
      </div>
      <div className="flex items-center gap-1 text-[10px] text-blue-400 font-medium flex-shrink-0">
        <span>Paradas</span>
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </div>
    </motion.button>
  );
}

function dist(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
