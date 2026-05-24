"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useVehicles } from "@/hooks/useVehicles";
import { useLocation } from "@/hooks/useLocation";
import { useArrivals } from "@/hooks/useArrivals";
import { formatEta, lineColorFromId } from "@/lib/utils";

// Leaflet solo en el cliente (no SSR)
const LeafletMap = dynamic(() => import("@/components/map/LeafletMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-[#0f172a] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm">Cargando mapa…</p>
      </div>
    </div>
  ),
});

export default function MapScreen() {
  const { location } = useLocation();
  const { vehicles, loading } = useVehicles(8000);
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [filterLine, setFilterLine] = useState<string | null>(null);

  const filteredVehicles = filterLine
    ? vehicles.filter((v) => v.lineId === filterLine)
    : vehicles;

  const uniqueLines = Array.from(new Set(vehicles.map((v) => v.lineId))).slice(0, 8);

  const selectedInfo = vehicles.find((v) => v.vehicleId === selectedVehicle);

  return (
    <div className="flex flex-col h-full relative">
      {/* Header flotante */}
      <div className="absolute top-0 left-0 right-0 z-[1000] px-4 pt-14 pb-3 pointer-events-none">
        <div className="flex items-center justify-between pointer-events-auto">
          <div className="glass-dark rounded-2xl px-4 py-2.5 flex items-center gap-2.5">
            <div className="relative">
              <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
              {!loading && (
                <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-green-400 animate-ping opacity-60" />
              )}
            </div>
            <span className="text-sm font-semibold text-white">
              {loading ? "Actualizando…" : `${filteredVehicles.length} buses en vivo`}
            </span>
          </div>

          {/* Botón re-centrar */}
          <button
            onClick={() => {}}
            className="glass-dark w-10 h-10 rounded-2xl flex items-center justify-center text-slate-300"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            </svg>
          </button>
        </div>
      </div>

      {/* Filtros de línea */}
      {uniqueLines.length > 0 && (
        <div className="absolute top-28 left-0 right-0 z-[1000] pointer-events-none">
          <div className="flex gap-2 overflow-x-auto px-4 scrollbar-none pointer-events-auto pb-1">
            <button
              onClick={() => setFilterLine(null)}
              className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                !filterLine
                  ? "bg-blue-600 text-white"
                  : "glass-dark text-slate-400"
              }`}
            >
              Todas
            </button>
            {uniqueLines.map((line) => (
              <button
                key={line}
                onClick={() => setFilterLine(filterLine === line ? null : line)}
                className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  filterLine === line
                    ? "text-white"
                    : "glass-dark text-slate-400"
                }`}
                style={filterLine === line ? { backgroundColor: lineColorFromId(line) } : {}}
              >
                {line}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Mapa */}
      <div className="flex-1">
        <LeafletMap
          center={location ? [location.lat, location.lon] : [-34.9058, -56.1882]}
          vehicles={filteredVehicles}
          onVehicleSelect={setSelectedVehicle}
          selectedVehicle={selectedVehicle}
        />
      </div>

      {/* Panel info vehículo seleccionado */}
      <AnimatePresence>
        {selectedInfo && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="absolute bottom-0 left-0 right-0 z-[1000] px-4 pb-4"
          >
            <div className="glass-dark rounded-3xl p-4 border border-white/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white text-sm"
                    style={{ backgroundColor: lineColorFromId(selectedInfo.lineId) + "44", border: `2px solid ${lineColorFromId(selectedInfo.lineId)}` }}
                  >
                    {selectedInfo.lineName}
                  </div>
                  <div>
                    <p className="text-white font-bold">Línea {selectedInfo.lineName}</p>
                    <p className="text-slate-400 text-xs">{Math.round(selectedInfo.speed)} km/h · ID {selectedInfo.vehicleId}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedVehicle(null)}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-slate-400"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
