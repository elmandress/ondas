"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "@/hooks/useLocation";
import { useArrivals } from "@/hooks/useArrivals";
import { useStopsDataset } from "@/hooks/useStopsDataset";
import { getPrefs, type FavoriteRoute } from "@/lib/store";
import { useFavoriteStops, removeFavoriteStop, aliasIcon, type FavoriteStop } from "@/lib/favorite-stops";
import AliasEditor from "@/components/home/AliasEditor";
import { getNearbyStopsClient, distanceTo, formatEta } from "@/lib/utils";
import { type BusStop } from "@/lib/stm";
import StopArrivalSheet from "@/components/home/StopArrivalSheet";
import RoutesManager from "@/components/home/RoutesManager";

type Tab = "home" | "route" | "map" | "search";

interface HomeScreenProps {
  onTabChange: (tab: Tab) => void;
}

export default function HomeScreen({ onTabChange }: HomeScreenProps) {
  const { location, isReal: locationIsReal } = useLocation();
  const { ready: stopsReady } = useStopsDataset();
  const [nearbyStops, setNearbyStops] = useState<BusStop[]>([]);
  const [activeStopId, setActiveStopId] = useState<string | null>(null);
  const [sheetStopId, setSheetStopId] = useState<string | null>(null);
  const [showRoutesManager, setShowRoutesManager] = useState(false);
  // Favoritos: inicializar vacío para evitar hydration mismatch, cargar en useEffect
  const [favorites, setFavorites] = useState<FavoriteRoute[]>([]);
  // Paradas favoritas reactivas (modelo nuevo, simple)
  const favoriteStops = useFavoriteStops();
  // Modal para editar alias (long-press en favorito o desde menú)
  const [editingAlias, setEditingAlias] = useState<{ stopId: string; stopName: string; alias?: string } | null>(null);

  // Separar atajos (con alias) del resto
  const shortcuts = favoriteStops.filter((f) => !!f.alias);
  const otherFavs = favoriteStops.filter((f) => !f.alias);
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  // Todo lo que toca localStorage/Date: solo en cliente
  useEffect(() => {
    setMounted(true);
    setNow(new Date());
    setFavorites(getPrefs().favoriteRoutes);
    const clockId = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(clockId);
  }, []);

  // Paradas cercanas — necesita ubicación + dataset cargado
  useEffect(() => {
    if (!location || !stopsReady) return;
    const stops = getNearbyStopsClient(location.lat, location.lon, 700);
    setNearbyStops(stops);
    if (stops.length > 0 && !activeStopId) {
      setActiveStopId(stops[0].stopId);
    }
  }, [location, stopsReady]);

  const greeting = now ? getGreeting(now) : "Buen día";

  return (
    <div className="flex flex-col h-full overflow-y-auto overflow-x-hidden">

      {/* ── HEADER ── */}
      <header className="px-5 pt-[max(env(safe-area-inset-top),48px)] pb-4 flex-shrink-0">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-slate-500 text-[13px] font-medium">{greeting}</p>
            <h1 className="text-title-large mt-1">Ondas</h1>
          </div>
        </div>
      </header>

      {/* ── HERO: ¿CUÁNDO SALÍS? — temporalmente desactivado, "PRÓXIMAMENTE" ── */}
      {/* La feature está pensada para integrar todo (caminata GPS, llegada en vivo,
          urgencia) en un solo countdown. Quedó deshabilitada hasta refinarla
          (necesita más calibración de tiempos de caminata y manejo de baja señal). */}
      <section className="px-5 mb-5 flex-shrink-0">
        <div className="relative h-44 rounded-3xl border border-white/[0.06] bg-gradient-to-br from-slate-800/40 via-slate-900/40 to-transparent overflow-hidden">
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-400 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30">
              Próximamente
            </span>
            <h2 className="text-xl font-black text-white mt-1">¿Cuándo salís?</h2>
            <p className="text-[12px] text-slate-500 leading-snug max-w-[260px]">
              Te vamos a avisar el momento exacto para salir según tu caminata y el próximo bus.
            </p>
          </div>
        </div>
      </section>

      {/* ── SELECTOR DE PARADA ACTIVA ── */}
      {nearbyStops.length > 1 && (
        <section className="px-5 mb-6 flex-shrink-0">
          <p className="text-eyebrow mb-2.5">Paradas cercanas</p>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
            {nearbyStops.map((stop) => {
              const active = stop.stopId === activeStopId;
              const dist = location && locationIsReal ? distanceTo(location.lat, location.lon, stop.stopLat, stop.stopLon) : null;
              return (
                <motion.button
                  key={stop.stopId}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setActiveStopId(stop.stopId)}
                  className="flex-shrink-0 rounded-xl px-3.5 py-2.5 text-left min-w-[140px]"
                  style={{
                    background: active ? "var(--accent-soft)" : "var(--surface)",
                    border: active ? "1px solid rgba(59,130,246,0.4)" : "1px solid var(--border)",
                  }}
                >
                  <p className={`text-[13px] font-semibold truncate ${active ? "text-blue-300" : "text-white"}`}>
                    {stop.stopName.split(" – ")[0]}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {dist !== null ? (dist < 1000 ? `${dist}m` : `${(dist / 1000).toFixed(1)}km`) : ""}
                    {dist !== null && " · "}{stop.lines.length} líneas
                  </p>
                </motion.button>
              );
            })}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => onTabChange("map")}
              className="flex-shrink-0 rounded-xl px-3 py-2.5 flex flex-col items-center justify-center gap-1"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <polygon points="3 11 22 2 13 21 11 13 3 11" />
              </svg>
              <span className="text-[10px] text-slate-500 font-medium">Mapa</span>
            </motion.button>
          </div>
        </section>
      )}

      {/* ── ATAJOS (Casa / Trabajo / Facu) ── */}
      {mounted && shortcuts.length > 0 && (
        <section className="px-5 mb-5 flex-shrink-0">
          <p className="text-eyebrow mb-2.5">Mis atajos</p>
          <div className="grid grid-cols-2 gap-2">
            {shortcuts.slice(0, 4).map((fav) => (
              <ShortcutCard
                key={fav.stopId}
                fav={fav}
                onTap={() => setSheetStopId(fav.stopId)}
                onLongPress={() => setEditingAlias({ stopId: fav.stopId, stopName: fav.stopName, alias: fav.alias })}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── PARADAS FAVORITAS (★) — sin alias ── */}
      {mounted && otherFavs.length > 0 && (
        <section className="px-5 mb-6 flex-shrink-0">
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-eyebrow">⭐ Paradas favoritas</p>
            <p className="text-[11px] text-slate-600">{otherFavs.length}</p>
          </div>
          <div className="space-y-2">
            {otherFavs.slice(0, 6).map((fav) => (
              <FavoriteStopRow
                key={fav.stopId}
                fav={fav}
                onTap={() => setSheetStopId(fav.stopId)}
                onRemove={() => removeFavoriteStop(fav.stopId)}
                onEditAlias={() => setEditingAlias({ stopId: fav.stopId, stopName: fav.stopName, alias: fav.alias })}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── FAVORITOS ── */}
      {mounted && (
        <section className="px-5 mb-6 flex-shrink-0">
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-eyebrow">Mis rutas</p>
            <button onClick={() => setShowRoutesManager(true)} className="text-[13px] text-blue-400 font-semibold">
              {favorites.length > 0 ? "Editar" : "+ Agregar"}
            </button>
          </div>
          {favorites.length > 0 ? (
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
          ) : (
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowRoutesManager(true)}
              className="w-full card-soft px-4 py-4 flex items-center gap-3"
              style={{ borderStyle: "dashed" }}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "var(--accent-soft)" }}>
                <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </div>
              <p className="text-[13px] text-slate-500 text-left">Guardá tus rutas favoritas para acceso rápido</p>
            </motion.button>
          )}
        </section>
      )}

      {/* ── PARADAS CERCANAS (lista rápida) ── */}
      {nearbyStops.length > 0 && (
        <section className="px-5 mb-8 flex-shrink-0">
          <p className="text-eyebrow mb-2.5">Paradas cercanas</p>
          <div className="card overflow-hidden">
            {nearbyStops.slice(0, 5).map((stop, i) => {
              const dist = location && locationIsReal ? distanceTo(location.lat, location.lon, stop.stopLat, stop.stopLon) : null;
              const isActive = stop.stopId === activeStopId;
              return (
                <motion.button
                  key={stop.stopId}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => setSheetStopId(stop.stopId)}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="w-full px-4 py-3.5 flex items-center gap-3 text-left"
                  style={{
                    borderBottom: i < Math.min(nearbyStops.length, 5) - 1 ? "1px solid var(--border)" : "none",
                  }}
                >
                  <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: isActive ? "var(--accent-soft)" : "var(--surface)" }}>
                    <svg className="w-4 h-4" style={{ color: isActive ? "#60a5fa" : "#6b7691" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="4" width="20" height="14" rx="2" />
                      <path d="M22 9H2" />
                      <circle cx="7" cy="19" r="1.5" /><circle cx="17" cy="19" r="1.5" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-white truncate">{stop.stopName}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {dist !== null ? (dist < 1000 ? `${dist}m` : `${(dist / 1000).toFixed(1)}km`) : ""}
                      {dist !== null && " · "}{stop.lines.length} líneas
                    </p>
                  </div>
                  <svg className="w-4 h-4 flex-shrink-0" style={{ color: "var(--text-quaternary)" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </motion.button>
              );
            })}
          </div>
        </section>
      )}

      {/* ── ACCIONES STM (links a web IM) ── */}
      <section className="px-5 mb-6 flex-shrink-0">
        <p className="text-eyebrow mb-2.5">Acciones STM</p>
        <div className="grid grid-cols-2 gap-2">
          <a
            href="https://www.montevideo.gub.uy/aplicacion/consulta-tu-saldo-stm"
            target="_blank"
            rel="noopener noreferrer"
            className="card-soft px-3 py-3 flex flex-col items-start gap-1.5 active:scale-[0.98] transition-transform"
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                 style={{ background: "rgba(16,185,129,0.15)" }}>
              <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Saldo STM</p>
              <p className="text-[10px] text-slate-500">Consultar y recargar</p>
            </div>
          </a>
          <a
            href="https://montevideo.gub.uy/buzon-ciudadano"
            target="_blank"
            rel="noopener noreferrer"
            className="card-soft px-3 py-3 flex flex-col items-start gap-1.5 active:scale-[0.98] transition-transform"
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                 style={{ background: "rgba(168,85,247,0.15)" }}>
              <svg className="w-4 h-4 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Reportar</p>
              <p className="text-[10px] text-slate-500">Buzón ciudadano IM</p>
            </div>
          </a>
        </div>
      </section>

      {/* ── EDITOR DE ALIAS (Casa / Trabajo / custom) ── */}
      <AnimatePresence>
        {editingAlias && (
          <AliasEditor
            stopId={editingAlias.stopId}
            stopName={editingAlias.stopName}
            currentAlias={editingAlias.alias}
            onClose={() => setEditingAlias(null)}
          />
        )}
      </AnimatePresence>

      {/* ── SHEET DE LLEGADAS ── */}
      <AnimatePresence>
        {sheetStopId && (
          <StopArrivalSheet
            stopId={sheetStopId}
            onClose={() => setSheetStopId(null)}
          />
        )}
      </AnimatePresence>

      {/* ── GESTOR DE RUTAS ── */}
      <AnimatePresence>
        {showRoutesManager && (
          <RoutesManager
            onClose={() => setShowRoutesManager(false)}
            onChange={() => setFavorites(getPrefs().favoriteRoutes)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function FavoriteRouteRow({ route, index, onTap }: { route: FavoriteRoute; index: number; onTap: () => void }) {
  const { arrivals, loading } = useArrivals(route.fromStop, 35000);
  const next = arrivals[0];

  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onTap}
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="w-full card px-4 py-3.5 flex items-center gap-3 text-left"
    >
      <span className="text-xl flex-shrink-0">{route.emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-semibold text-white truncate">{route.name}</p>
        <p className="text-[11px] text-slate-500 truncate mt-0.5">{route.fromName}</p>
      </div>
      <div className="flex-shrink-0 text-right min-w-[56px]">
        {loading ? (
          <div className="w-12 h-7 skeleton rounded-lg" />
        ) : next ? (
          <>
            <p className={`text-[22px] font-black time-display ${next.eta <= 2 ? "text-emerald-400" : next.eta <= 8 ? "text-amber-400" : "text-slate-300"}`}>
              {formatEta(next.eta)}
            </p>
            {next.realtime && (
              <div className="flex items-center gap-1 justify-end mt-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[9px] text-emerald-400 font-semibold">EN VIVO</span>
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

// ── ShortcutCard ───────────────────────────────────────────────────
// Tarjeta destacada para atajos Casa/Trabajo/Facu. Long-press para editar alias.
function ShortcutCard({
  fav, onTap, onLongPress,
}: {
  fav: FavoriteStop;
  onTap: () => void;
  onLongPress: () => void;
}) {
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);

  const startPress = () => {
    longPressed.current = false;
    pressTimer.current = setTimeout(() => {
      longPressed.current = true;
      onLongPress();
    }, 500);
  };
  const cancelPress = () => {
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; }
  };
  const handleClick = () => {
    if (!longPressed.current) onTap();
  };

  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={handleClick}
      onMouseDown={startPress}
      onMouseUp={cancelPress}
      onMouseLeave={cancelPress}
      onTouchStart={startPress}
      onTouchEnd={cancelPress}
      onTouchCancel={cancelPress}
      onContextMenu={(e) => { e.preventDefault(); onLongPress(); }}
      className="card px-3 py-3 flex items-center gap-3 text-left"
    >
      <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 text-2xl"
           style={{ background: "rgba(59,130,246,0.12)" }}>
        {aliasIcon(fav.alias)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-white truncate">{fav.alias}</p>
        <p className="text-[10px] text-slate-500 truncate">{fav.stopName}</p>
        {fav.lines.length > 0 && (
          <p className="text-[10px] text-blue-400 font-semibold mt-0.5 truncate">
            {fav.lines.slice(0, 4).join(" · ")}
            {fav.lines.length > 4 && ` +${fav.lines.length - 4}`}
          </p>
        )}
      </div>
    </motion.button>
  );
}

// ── FavoriteStopRow ────────────────────────────────────────────────
function FavoriteStopRow({
  fav, onTap, onRemove, onEditAlias,
}: {
  fav: FavoriteStop;
  onTap: () => void;
  onRemove: () => void;
  onEditAlias?: () => void;
}) {
  return (
    <div className="card-soft px-3 py-2.5 flex items-center gap-3">
      <button onClick={onTap} className="flex-1 flex items-center gap-3 text-left min-w-0">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
             style={{ background: "rgba(251,191,36,0.15)" }}>
          <svg className="w-4 h-4 text-amber-400" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white truncate">
            {fav.alias || fav.stopName}
          </p>
          <p className="text-[11px] text-slate-500 truncate">
            #{fav.stopCode}
            {fav.lines.length > 0 && ` · ${fav.lines.slice(0, 6).join(" · ")}`}
            {fav.lines.length > 6 && ` · +${fav.lines.length - 6}`}
          </p>
        </div>
        <svg className="w-4 h-4 text-slate-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>
      {onEditAlias && (
        <button
          onClick={(e) => { e.stopPropagation(); onEditAlias(); }}
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(255,255,255,0.05)" }}
          aria-label="Etiquetar"
          title="Etiquetar como Casa/Trabajo/…"
        >
          <svg className="w-3 h-3 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: "rgba(255,255,255,0.05)" }}
        aria-label="Quitar de favoritos"
      >
        <svg className="w-3 h-3 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
