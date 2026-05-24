"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "@/hooks/useLocation";
import { useNearbyStops } from "@/hooks/useNearbyStops";
import { useArrivals } from "@/hooks/useArrivals";
import { getPrefs, type FavoriteRoute } from "@/lib/store";
import { formatEta, walkToLeaveTime, leaveNowUrgency, etaColorClass, formatTime } from "@/lib/utils";
import LeaveNowCard from "@/components/home/LeaveNowCard";
import FavoriteCard from "@/components/home/FavoriteCard";
import NearbyStopCard from "@/components/home/NearbyStopCard";
import ArrivalSheet from "@/components/home/ArrivalSheet";

type Tab = "home" | "map" | "search";

interface HomeScreenProps {
  onTabChange: (tab: Tab) => void;
}

export default function HomeScreen({ onTabChange }: HomeScreenProps) {
  const { location } = useLocation();
  const { stops } = useNearbyStops(location?.lat ?? null, location?.lon ?? null);
  const [selectedStop, setSelectedStop] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<FavoriteRoute[]>([]);
  const [now, setNow] = useState(new Date());
  const [showSheet, setShowSheet] = useState(false);

  // Reloj que actualiza cada minuto
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  // Cargar favoritos
  useEffect(() => {
    setFavorites(getPrefs().favoriteRoutes);
  }, []);

  // Parada principal: primera parada cercana o la de la ruta favorita #1
  const primaryStop = stops[0]?.stopId || null;
  const { arrivals, loading, lastUpdated, refetch } = useArrivals(
    selectedStop || primaryStop,
    20000
  );

  const activeStop = stops.find((s) => s.stopId === (selectedStop || primaryStop));

  return (
    <div className="flex flex-col h-full overflow-y-auto overflow-x-hidden">
      {/* Header */}
      <div className="px-5 pt-14 pb-4 shrink-0">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-slate-400 text-sm font-medium">
              {formatTime(now)} · {getDayGreeting()}
            </p>
            <h1 className="text-2xl font-bold text-white mt-0.5 tracking-tight">
              ¿Cuándo salís?
            </h1>
          </div>

          {/* Avatar / Perfil */}
          <button className="w-10 h-10 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 text-sm font-bold">
            Vos
          </button>
        </div>

        {/* Chip de ubicación */}
        {activeStop && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 mt-3"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 radar-dot relative" />
            <span className="text-xs text-slate-400 truncate max-w-[220px]">
              {activeStop.stopName}
            </span>
            <button
              onClick={() => onTabChange("map")}
              className="text-xs text-blue-400 font-medium ml-auto shrink-0"
            >
              Ver mapa
            </button>
          </motion.div>
        )}
      </div>

      {/* ZONA HERO — Próximo bus + LeaveNow */}
      <div className="px-5 mb-5 shrink-0">
        {loading && !arrivals.length ? (
          <div className="h-36 skeleton rounded-3xl" />
        ) : arrivals.length > 0 ? (
          <LeaveNowCard
            arrivals={arrivals.slice(0, 3)}
            walkMinutes={favorites[0]?.walkMinutes || 5}
            stopName={activeStop?.stopName}
            onTap={() => setShowSheet(true)}
          />
        ) : (
          <div className="h-36 glass rounded-3xl flex items-center justify-center">
            <p className="text-slate-500 text-sm">Buscando buses cercanos…</p>
          </div>
        )}
      </div>

      {/* SECCIÓN: Mis rutas */}
      {favorites.length > 0 && (
        <section className="px-5 mb-5 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
              Mis Rutas
            </h2>
            <button className="text-xs text-blue-400 font-medium">Editar</button>
          </div>
          <div className="space-y-2">
            {favorites.map((fav, i) => (
              <motion.div
                key={fav.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
              >
                <FavoriteCard
                  route={fav}
                  onTap={() => {
                    setSelectedStop(fav.fromStop);
                    setShowSheet(true);
                  }}
                />
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* SECCIÓN: Paradas cercanas */}
      {stops.length > 0 && (
        <section className="px-5 mb-6 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
              Paradas Cercanas
            </h2>
          </div>
          <div className="space-y-2">
            {stops.slice(0, 3).map((stop, i) => (
              <motion.div
                key={stop.stopId}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.06 }}
              >
                <NearbyStopCard
                  stop={stop}
                  isActive={stop.stopId === (selectedStop || primaryStop)}
                  onTap={() => {
                    setSelectedStop(stop.stopId);
                    setShowSheet(true);
                  }}
                />
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Sheet de llegadas */}
      <AnimatePresence>
        {showSheet && (
          <ArrivalSheet
            stopName={activeStop?.stopName || "Parada"}
            arrivals={arrivals}
            loading={loading}
            lastUpdated={lastUpdated}
            onClose={() => setShowSheet(false)}
            onRefresh={refetch}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function getDayGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 20) return "Buenas tardes";
  return "Buenas noches";
}
