"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useVehicles } from "@/hooks/useVehicles";
import { useLocation } from "@/hooks/useLocation";
import { useArrivals } from "@/hooks/useArrivals";
import { STOPS_DATASET, lineColorFromCode, type BusStop } from "@/lib/stm";
import { formatEta, etaColorClass, getNearbyStopsClient } from "@/lib/utils";

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
  const { vehicles, loading: vehiclesLoading } = useVehicles(8000);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [filterLine, setFilterLine] = useState<string | null>(null);
  const [visibleStops, setVisibleStops] = useState<BusStop[]>([]);

  const center: [number, number] = location
    ? [location.lat, location.lon]
    : [-34.9058, -56.1882];

  // Calcular paradas visibles según ubicación
  useEffect(() => {
    const nearby = location
      ? STOPS_DATASET.filter(s => {
          const dlat = (s.stopLat - location.lat) ** 2;
          const dlon = (s.stopLon - location.lon) ** 2;
          return Math.sqrt(dlat + dlon) < 0.05; // ~5km radio visual
        })
      : STOPS_DATASET.slice(0, 20);
    setVisibleStops(nearby);
  }, [location]);

  const filteredVehicles = filterLine
    ? vehicles.filter((v) => v.lineId === filterLine)
    : vehicles;

  const uniqueLines = Array.from(new Set(vehicles.map((v) => v.lineId))).slice(0, 10);
  const selectedStop = STOPS_DATASET.find((s) => s.stopId === selectedStopId);
  const selectedVehicle = vehicles.find((v) => v.vehicleId === selectedVehicleId);

  const { arrivals, loading: arrivalsLoading, lastUpdated, refetch } = useArrivals(selectedStopId, 20000);

  function clearSelections() {
    setSelectedStopId(null);
    setSelectedVehicleId(null);
  }

  return (
    <div className="flex flex-col h-full relative bg-[#0f172a]">

      {/* ── HEADER FLOTANTE ── */}
      <div className="absolute top-0 left-0 right-0 z-[1000] pt-14 px-4 pb-2 pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Estado de buses en vivo */}
          <div className="glass-dark rounded-2xl px-3.5 py-2 flex items-center gap-2.5 flex-1">
            <div className="relative flex-shrink-0">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              {!vehiclesLoading && (
                <div className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-60" />
              )}
            </div>
            <span className="text-sm font-semibold text-white">
              {vehiclesLoading ? "Cargando…" : `${filteredVehicles.length} buses en vivo`}
            </span>
            <span className="text-slate-500 text-xs ml-auto">
              {STOPS_DATASET.length} paradas
            </span>
          </div>

          {/* Botón centrar */}
          <button
            onClick={clearSelections}
            className="glass-dark w-10 h-10 rounded-2xl flex items-center justify-center text-slate-300 flex-shrink-0"
            aria-label="Deseleccionar"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── FILTROS DE LÍNEA ── */}
      <div className="absolute top-[88px] left-0 right-0 z-[999] pointer-events-none">
        <div className="flex gap-2 overflow-x-auto px-4 scrollbar-none pointer-events-auto">
          <button
            onClick={() => setFilterLine(null)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              !filterLine ? "bg-blue-600 text-white" : "glass-dark text-slate-400"
            }`}
          >
            Todas
          </button>
          {uniqueLines.map((line) => {
            const color = lineColorFromCode(line);
            const active = filterLine === line;
            return (
              <button
                key={line}
                onClick={() => setFilterLine(active ? null : line)}
                className="flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all glass-dark"
                style={active ? { backgroundColor: color, color: "white", border: `1px solid ${color}` } : { color: "#94a3b8" }}
              >
                {line}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── MAPA ── */}
      <div className="flex-1">
        <LeafletMap
          center={center}
          vehicles={filteredVehicles}
          stops={visibleStops}
          selectedStopId={selectedStopId}
          selectedVehicleId={selectedVehicleId}
          onStopSelect={(id) => { setSelectedStopId(id); setSelectedVehicleId(null); }}
          onVehicleSelect={setSelectedVehicleId}
          onMapClick={clearSelections}
        />
      </div>

      {/* ── PANEL PARADA SELECCIONADA ── */}
      <AnimatePresence>
        {selectedStop && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="absolute bottom-0 left-0 right-0 z-[1001]"
          >
            <div className="glass-dark border-t border-white/10 rounded-t-3xl overflow-hidden">
              {/* Handle */}
              <div className="flex justify-center pt-2.5 pb-0">
                <div className="w-8 h-1 rounded-full bg-white/20" />
              </div>

              {/* Header parada */}
              <div className="px-4 pt-3 pb-0 flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400 mb-0.5">
                    Parada #{selectedStop.stopCode}
                  </p>
                  <h3 className="text-base font-bold text-white leading-tight truncate pr-2">
                    {selectedStop.stopName}
                  </h3>
                  {/* Líneas disponibles */}
                  <div className="flex gap-1.5 flex-wrap mt-2">
                    {selectedStop.lines.map((l) => (
                      <span
                        key={l}
                        className="text-[10px] font-bold px-2 py-0.5 rounded-lg text-white"
                        style={{ backgroundColor: lineColorFromCode(l) + "33", border: `1px solid ${lineColorFromCode(l)}55` }}
                      >
                        {l}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-2">
                  <button
                    onClick={refetch}
                    className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center"
                  >
                    <svg className={`w-3.5 h-3.5 text-slate-400 ${arrivalsLoading ? "animate-spin" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                      <polyline points="23 4 23 10 17 10" />
                      <polyline points="1 20 1 14 7 14" />
                      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                    </svg>
                  </button>
                  <button
                    onClick={clearSelections}
                    className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center"
                  >
                    <svg className="w-3.5 h-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Llegadas */}
              <div className="px-4 pt-3 pb-5 max-h-[42vh] overflow-y-auto space-y-2">
                {arrivalsLoading && !arrivals.length ? (
                  [1, 2, 3].map((i) => <div key={i} className="h-14 skeleton rounded-2xl" />)
                ) : arrivals.length === 0 ? (
                  <p className="text-slate-500 text-sm text-center py-6">
                    Sin buses en los próximos 30 minutos
                  </p>
                ) : (
                  arrivals.map((a, i) => {
                    const color = a.lineColor || lineColorFromCode(a.lineId);
                    const urgent = a.eta <= 2;
                    return (
                      <motion.div
                        key={`${a.lineId}-${i}`}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className={`flex items-center gap-3 px-3.5 py-3 rounded-2xl ${urgent ? "bg-green-500/10 border border-green-500/20" : "bg-white/[0.04]"}`}
                      >
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs text-white flex-shrink-0"
                          style={{ backgroundColor: color + "33", border: `1.5px solid ${color}55` }}
                        >
                          {a.lineName}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{a.destination}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {a.realtime ? (
                              <span className="flex items-center gap-1 text-[10px] text-green-400 font-medium">
                                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />Tiempo real
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-500">Programado</span>
                            )}
                            {a.distance && (
                              <span className="text-[10px] text-slate-600">· {Math.round(a.distance)}m</span>
                            )}
                          </div>
                        </div>
                        <p className={`text-xl font-black time-display flex-shrink-0 ${urgent ? "text-green-400 countdown-urgent" : etaColorClass(a.eta)}`}>
                          {formatEta(a.eta)}
                        </p>
                      </motion.div>
                    );
                  })
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── INFO VEHÍCULO SELECCIONADO ── */}
      <AnimatePresence>
        {selectedVehicle && !selectedStop && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 280 }}
            className="absolute bottom-4 left-4 right-4 z-[1001]"
          >
            <div className="glass-dark rounded-2xl p-4 border border-white/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center font-black text-sm text-white"
                    style={{ backgroundColor: lineColorFromCode(selectedVehicle.lineId) + "44", border: `2px solid ${lineColorFromCode(selectedVehicle.lineId)}88` }}
                  >
                    {selectedVehicle.lineName}
                  </div>
                  <div>
                    <p className="text-white font-bold text-sm">Línea {selectedVehicle.lineName}</p>
                    <p className="text-slate-400 text-xs">
                      {Math.round(selectedVehicle.speed)} km/h · Bus #{selectedVehicle.vehicleId}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedVehicleId(null)}
                  className="w-8 h-8 rounded-xl bg-white/8 flex items-center justify-center"
                >
                  <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
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
