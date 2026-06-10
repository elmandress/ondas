"use client";

/**
 * Panel bottom-sheet del lugar buscado (FR-3.8): el lugar pineado en el mapa
 * + paradas a ≤400m con sus líneas. Tocar una parada abre su panel.
 */
import { useMemo } from "react";
import { motion } from "framer-motion";
import { STOPS_DATASET, type BusStop } from "@/lib/stm";
import { distanceTo } from "@/lib/utils";
import type { SelectedPlace } from "@/lib/selected-place";

interface Props {
  place: SelectedPlace;
  /** true cuando STOPS_DATASET ya está cargado (useStopsDataset). */
  stopsReady: boolean;
  onClose: () => void;
  onSelectStop: (stopId: string) => void;
}

export default function PlacePanel({ place, stopsReady, onClose, onSelectStop }: Props) {
  // Paradas en radio 400m del lugar (FR-3.8)
  const nearbyStops = useMemo<{ stop: BusStop; distanceM: number }[]>(() => {
    if (!stopsReady) return [];
    const RADIUS_M = 400;
    return STOPS_DATASET
      .map((s) => ({ stop: s, distanceM: distanceTo(place.lat, place.lon, s.stopLat, s.stopLon) }))
      .filter((x) => x.distanceM <= RADIUS_M)
      .sort((a, b) => a.distanceM - b.distanceM)
      .slice(0, 8);
  }, [place, stopsReady]);

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 30, stiffness: 320 }}
      className="map-overlay-card absolute bottom-0 left-0 right-0 z-[1001]"
    >
      <div className="bg-[#0a0f1c]/97 backdrop-blur-xl border-t border-white/[0.07] rounded-t-[18px] overflow-hidden" style={{ boxShadow: "var(--shadow-sheet)" }}>
        <div className="flex justify-center pt-2.5 pb-1.5">
          <div className="w-9 h-[3px] rounded-full bg-white/15" />
        </div>

        <div className="px-4 pb-3 flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 text-xl"
               style={{ background: "rgba(220,38,38,0.15)", border: "1px solid rgba(220,38,38,0.3)" }}>
            {place.icon || "📍"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-red-400">Lugar</p>
            <p className="text-sm text-white font-bold truncate">{place.name}</p>
            {place.fullName && (
              <p className="text-[10px] text-slate-600 truncate">{place.fullName.split(",").slice(0, 2).join(",")}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/[0.06] flex items-center justify-center flex-shrink-0"
            aria-label="Cerrar lugar"
          >
            <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="px-4 pb-5 max-h-[44vh] overflow-y-auto">
          {nearbyStops.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-slate-500 text-sm">Sin paradas a menos de 400m</p>
              <p className="text-slate-700 text-xs mt-1">Probá un lugar más cercano al centro</p>
            </div>
          ) : (
            <>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2.5">
                Paradas cercanas ({nearbyStops.length})
              </p>
              <div className="space-y-1.5">
                {nearbyStops.map(({ stop, distanceM }, i) => (
                  <motion.button
                    key={stop.stopId}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onSelectStop(stop.stopId)}
                    className="w-full text-left bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.05] rounded-xl px-3 py-2.5 flex items-center gap-3"
                  >
                    <div className="w-9 h-9 rounded-lg bg-white/[0.06] flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <rect x="2" y="6" width="20" height="12" rx="2"/>
                        <path d="M22 10H2"/>
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{stop.stopName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-amber-400 font-medium">{distanceM}m</span>
                        <span className="text-[10px] text-slate-700">·</span>
                        <span className="text-[10px] text-slate-500">#{stop.stopCode}</span>
                        <div className="flex gap-1 ml-1">
                          {stop.lines.slice(0, 5).map((l) => (
                            <span key={l} className="text-[9px] font-bold text-slate-300 px-1 py-0 rounded bg-white/[0.06]">{l}</span>
                          ))}
                          {stop.lines.length > 5 && (
                            <span className="text-[9px] text-slate-700">+{stop.lines.length - 5}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <svg className="w-4 h-4 text-slate-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </motion.button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}
