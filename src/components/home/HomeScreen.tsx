"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "@/hooks/useLocation";
import { useArrivals } from "@/hooks/useArrivals";
import { getPrefs, type FavoriteRoute } from "@/lib/store";
import { getNearbyStopsClient, walkingMinutes, distanceTo, formatEta, formatTime } from "@/lib/utils";
import { STOPS_DATASET, lineColorFromCode, type BusStop } from "@/lib/stm";
import LeaveNowHero from "@/components/home/LeaveNowHero";
import StopArrivalSheet from "@/components/home/StopArrivalSheet";

type Tab = "home" | "map" | "search";

interface HomeScreenProps {
  onTabChange: (tab: Tab) => void;
}

export default function HomeScreen({ onTabChange }: HomeScreenProps) {
  const { location, loading: locationLoading } = useLocation();
  const [nearbyStops, setNearbyStops] = useState<BusStop[]>([]);
  const [activeStopId, setActiveStopId] = useState<string | null>(null);
  const [sheetStopId, setSheetStopId] = useState<string | null>(null);
  const [favorites] = useState<FavoriteRoute[]>(() => getPrefs().favoriteRoutes);
  const [now, setNow] = useState(new Date());

  // Reloj vivo
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  // Paradas cercanas apenas tenemos ubicación
  useEffect(() => {
    if (!location) return;
    const stops = getNearbyStopsClient(location.lat, location.lon, 700);
    setNearbyStops(stops);
    if (stops.length > 0 && !activeStopId) {
      setActiveStopId(stops[0].stopId);
    }
  }, [location]);

  // Llegadas de la parada activa (el LeaveNow hero)
  const { arrivals: heroArrivals, loading: heroLoading, lastUpdated } = useArrivals(activeStopId, 20000);

  const activeStop = STOPS_DATASET.find((s) => s.stopId === activeStopId);
  const walkMins = activeStop && location
    ? walkingMinutes(distanceTo(location.lat, location.lon, activeStop.stopLat, activeStop.stopLon))
    : 5;

  const greeting = getGreeting(now);

  return (
    <div className="flex flex-col h-full overflow-y-auto overflow-x-hidden">

      {/* ── HEADER ── */}
      <header className="px-5 pt-14 pb-5 flex-shrink-0">
        <div className="flex items-start justify-between mb-1">
          <div>
            <p className="text-slate-500 text-sm font-medium">{greeting}</p>
            <h1 className="text-[28px] font-black text-white tracking-tight leading-tight mt-0.5">
              ¿Cuándo salís?
            </h1>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            {lastUpdated && (
              <span className="text-[10px] text-slate-600">{formatTime(lastUpdated)}</span>
            )}
            <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
          </div>
        </div>
      </header>

      {/* ── HERO: LEAVE NOW ── */}
      <section className="px-5 mb-5 flex-shrink-0">
        {locationLoading || (nearbyStops.length === 0 && !location) ? (
          <div className="h-44 skeleton rounded-3xl" />
        ) : (
          <LeaveNowHero
            arrivals={heroArrivals}
            loading={heroLoading}
            walkMinutes={walkMins}
            stopName={activeStop?.stopName}
            onTap={() => activeStopId && setSheetStopId(activeStopId)}
          />
        )}
      </section>

      {/* ── SELECTOR DE PARADA ACTIVA ── */}
      {nearbyStops.length > 1 && (
        <section className="px-5 mb-5 flex-shrink-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2.5">
            Paradas cercanas
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {nearbyStops.map((stop) => {
              const active = stop.stopId === activeStopId;
              const dist = location ? distanceTo(location.lat, location.lon, stop.stopLat, stop.stopLon) : 0;
              return (
                <motion.button
                  key={stop.stopId}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setActiveStopId(stop.stopId)}
                  className={`flex-shrink-0 rounded-2xl px-3.5 py-2.5 text-left transition-all ${
                    active
                      ? "bg-blue-600/20 border border-blue-500/40"
                      : "glass border border-transparent"
                  }`}
                >
                  <p className={`text-xs font-bold truncate max-w-[140px] ${active ? "text-blue-300" : "text-white"}`}>
                    {stop.stopName.split(" – ")[0]}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    #{stop.stopCode} · {dist < 1000 ? `${dist}m` : `${(dist / 1000).toFixed(1)}km`}
                  </p>
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {stop.lines.slice(0, 3).map((l) => (
                      <span
                        key={l}
                        className="text-[9px] font-black px-1.5 py-0.5 rounded-md text-white"
                        style={{ backgroundColor: lineColorFromCode(l) + "44" }}
                      >
                        {l}
                      </span>
                    ))}
                    {stop.lines.length > 3 && (
                      <span className="text-[9px] text-slate-600">+{stop.lines.length - 3}</span>
                    )}
                  </div>
                </motion.button>
              );
            })}
            {/* Botón ver todas en mapa */}
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => onTabChange("map")}
              className="flex-shrink-0 glass rounded-2xl px-3.5 py-2.5 flex flex-col items-center justify-center gap-1 min-w-[70px]"
            >
              <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <polygon points="3 11 22 2 13 21 11 13 3 11" />
              </svg>
              <span className="text-[10px] text-slate-500 font-medium">Mapa</span>
            </motion.button>
          </div>
        </section>
      )}

      {/* ── FAVORITOS ── */}
      {favorites.length > 0 && (
        <section className="px-5 mb-5 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Mis rutas</p>
            <button className="text-xs text-blue-400 font-medium">Editar</button>
          </div>
          <div className="space-y-2">
            {favorites.map((fav, i) => (
              <FavoriteRouteRow
                key={fav.id}
                route={fav}
                index={i}
                onTap={() => setSheetStopId(fav.fromStop)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── PRÓXIMAS PARADAS (lista rápida) ── */}
      {nearbyStops.length > 0 && (
        <section className="px-5 mb-8 flex-shrink-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">
            Próximas llegadas cercanas
          </p>
          <div className="space-y-2">
            {nearbyStops.slice(0, 4).map((stop, i) => (
              <motion.button
                key={stop.stopId}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSheetStopId(stop.stopId)}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="w-full glass rounded-2xl px-4 py-3.5 flex items-center gap-3 text-left"
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${stop.stopId === activeStopId ? "bg-blue-600/25" : "bg-white/5"}`}>
                  <svg className={`w-4 h-4 ${stop.stopId === activeStopId ? "text-blue-400" : "text-slate-500"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="6" width="20" height="12" rx="2" />
                    <path d="M22 10H2" />
                    <circle cx="7" cy="18" r="1.5" />
                    <circle cx="17" cy="18" r="1.5" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{stop.stopName}</p>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {stop.lines.slice(0, 4).map((l) => (
                      <span key={l} className="text-[9px] font-bold px-1.5 py-0.5 rounded-md text-white" style={{ backgroundColor: lineColorFromCode(l) + "40" }}>
                        {l}
                      </span>
                    ))}
                    {stop.lines.length > 4 && <span className="text-[9px] text-slate-600">+{stop.lines.length - 4}</span>}
                  </div>
                </div>
                <svg className="w-4 h-4 text-slate-700 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </motion.button>
            ))}
          </div>
        </section>
      )}

      {/* ── SHEET DE LLEGADAS ── */}
      <AnimatePresence>
        {sheetStopId && (
          <StopArrivalSheet
            stopId={sheetStopId}
            onClose={() => setSheetStopId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── COMPONENTE: Fila de ruta favorita ──────────────────────────────
function FavoriteRouteRow({ route, index, onTap }: { route: FavoriteRoute; index: number; onTap: () => void }) {
  const { arrivals, loading } = useArrivals(route.fromStop, 35000);
  const next = arrivals[0];

  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onTap}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="w-full glass rounded-2xl px-4 py-3.5 flex items-center gap-3 text-left"
    >
      <span className="text-xl flex-shrink-0">{route.emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{route.name}</p>
        <p className="text-[11px] text-slate-500 truncate mt-0.5">{route.fromName}</p>
        <div className="flex gap-1 mt-1.5 flex-wrap">
          {route.lines.slice(0, 3).map((l) => (
            <span key={l} className="text-[9px] font-bold px-1.5 py-0.5 rounded-md text-white" style={{ backgroundColor: lineColorFromCode(l) + "40" }}>
              {l}
            </span>
          ))}
        </div>
      </div>
      <div className="flex-shrink-0 text-right min-w-[56px]">
        {loading ? (
          <div className="w-12 h-7 skeleton rounded-lg" />
        ) : next ? (
          <>
            <p className={`text-xl font-black time-display ${next.eta <= 2 ? "text-green-400" : next.eta <= 8 ? "text-orange-400" : "text-slate-300"}`}>
              {formatEta(next.eta)}
            </p>
            {next.realtime && (
              <div className="flex items-center gap-1 justify-end mt-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[9px] text-green-400">EN VIVO</span>
              </div>
            )}
          </>
        ) : (
          <p className="text-xs text-slate-600">—</p>
        )}
      </div>
    </motion.button>
  );
}

function getGreeting(date: Date): string {
  const h = date.getHours();
  const min = String(date.getMinutes()).padStart(2, "0");
  const timeStr = `${h}:${min}`;
  if (h < 12) return `Buenos días · ${timeStr}`;
  if (h < 20) return `Buenas tardes · ${timeStr}`;
  return `Buenas noches · ${timeStr}`;
}
