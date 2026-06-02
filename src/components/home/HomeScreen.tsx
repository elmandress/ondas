"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import { useLocation } from "@/hooks/useLocation";
import { useArrivals } from "@/hooks/useArrivals";
import { useStopsDataset } from "@/hooks/useStopsDataset";
import { getPrefs, type FavoriteRoute } from "@/lib/store";
import { useFavoriteStops, removeFavoriteStop, aliasIcon, type FavoriteStop } from "@/lib/favorite-stops";
import AliasEditor from "@/components/home/AliasEditor";
import LeaveNowHero from "@/components/home/LeaveNowHero";
import { getNearbyStopsClient, distanceTo, formatEta, walkingMinutes } from "@/lib/utils";
import { type BusStop, STOPS_DATASET } from "@/lib/stm";
import StopArrivalSheet from "@/components/home/StopArrivalSheet";
import RoutesManager from "@/components/home/RoutesManager";
import { LogoLockup } from "@/components/brand/Logo";
import { Icons } from "@/components/brand/Icons";
import LineBadge from "@/components/ui/LineBadge";
import PeakHint from "@/components/ui/PeakHint";
import SettingsSheet from "@/components/home/SettingsSheet";
import HowToSheet from "@/components/home/HowToSheet";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { setRouteInput } from "@/lib/route-input";

type Tab = "home" | "route" | "map" | "search";

interface HomeScreenProps {
  onTabChange: (tab: Tab) => void;
}

function distStr(d: number | null): string {
  if (d === null) return "";
  return d < 1000 ? `${d} m` : `${(d / 1000).toFixed(1)} km`;
}

export default function HomeScreen({ onTabChange }: HomeScreenProps) {
  const { location, isReal: locationIsReal, status: locationStatus } = useLocation();
  const { ready: stopsReady } = useStopsDataset();
  const [nearbyStops, setNearbyStops] = useState<BusStop[]>([]);
  const [activeStopId, setActiveStopId] = useState<string | null>(null);
  const [sheetStopId, setSheetStopId] = useState<string | null>(null);
  const [showRoutesManager, setShowRoutesManager] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);
  const [favorites, setFavorites] = useState<FavoriteRoute[]>([]);
  const favoriteStops = useFavoriteStops();
  const [editingAlias, setEditingAlias] = useState<{ stopId: string; stopName: string; alias?: string } | null>(null);

  // Abrir un favorito: ruta por dirección → planificador; ruta vieja por parada → sheet de llegadas.
  function openFavorite(fav: FavoriteRoute) {
    if (fav.toLat != null && fav.toLon != null) {
      const to = { lat: fav.toLat, lon: fav.toLon, name: fav.toName || fav.toAddress };
      const from = !fav.fromIsCurrentLocation && fav.fromLat != null && fav.fromLon != null
        ? { lat: fav.fromLat, lon: fav.fromLon, name: fav.fromName || fav.fromAddress }
        : undefined;
      setRouteInput({ from, to, fromCurrentLocation: fav.fromIsCurrentLocation });
      onTabChange("route");
    } else if (fav.fromStop) {
      setSheetStopId(fav.fromStop);
    }
  }

  const shortcuts = favoriteStops.filter((f) => !!f.alias);
  const otherFavs = favoriteStops.filter((f) => !f.alias);
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  // Hero "¿De dónde salís?": atajos (Casa/Trabajo) + parada más cercana.
  // Memoizado: sin esto se recalculaba en cada render (cada tick del reloj de 30s y
  // cada micro-update del GPS) creando objetos nuevos → el hero parpadeaba. Ahora solo
  // se recalcula si cambian las paradas o la ubicación de verdad (ya estabilizada).
  const [heroIdx, setHeroIdx] = useState(0);
  const heroSources = useMemo(() => {
    if (!mounted) return [];
    return [
      ...shortcuts.slice(0, 2).map((f) => {
        const stopData = STOPS_DATASET.find((s) => s.stopId === f.stopId);
        const walkMin = location && stopData
          ? walkingMinutes(distanceTo(location.lat, location.lon, stopData.stopLat, stopData.stopLon))
          : 5;
        return { stopId: f.stopId, stopName: f.stopName, alias: f.alias, walkMin };
      }),
      ...(nearbyStops.length > 0 && !shortcuts.some((s) => s.stopId === nearbyStops[0].stopId)
        ? [{
            stopId: nearbyStops[0].stopId,
            stopName: nearbyStops[0].stopName,
            alias: undefined as string | undefined,
            walkMin: location && locationIsReal
              ? walkingMinutes(distanceTo(location.lat, location.lon, nearbyStops[0].stopLat, nearbyStops[0].stopLon))
              : 5,
          }]
        : []),
    ];
  }, [mounted, shortcuts, nearbyStops, location, locationIsReal]);
  const heroSource = heroSources[Math.min(heroIdx, heroSources.length - 1)] ?? null;

  useEffect(() => {
    setMounted(true);
    setNow(new Date());
    setFavorites(getPrefs().favoriteRoutes);
    const clockId = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(clockId);
  }, []);

  useEffect(() => {
    if (!location || !stopsReady) return;
    const stops = getNearbyStopsClient(location.lat, location.lon, 700);
    setNearbyStops(stops);
    if (stops.length > 0 && !activeStopId) {
      setActiveStopId(stops[0].stopId);
    }
  }, [location, stopsReady]);

  const { arrivals: heroArrivals, loading: heroLoading } = useArrivals(heroSource?.stopId ?? null, 20000);

  const subhead = now ? getSubhead(now, locationIsReal) : "Tiempo real del STM";

  return (
    <div className="screen-home" style={{ paddingTop: "max(env(safe-area-inset-top), 8px)" }}>
      {/* Header mobile */}
      <div className="app-header mobile-only">
        <LogoLockup size={24} ring="var(--text)" dot="var(--accent)" />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {locationStatus === "pending"
            ? <span style={{ font: "var(--font-badge)", color: "var(--text-3)" }}>Ubicando…</span>
            : <span className="gps-dot" aria-label="GPS activo" />}
          <button onClick={() => setShowHowTo(true)} aria-label="Cómo usar" style={{ color: "var(--text-2)", display: "grid", placeItems: "center", width: 32, height: 32 }}>
            <Icons.Help size={20} />
          </button>
          <ThemeToggle size={32} />
          <button onClick={() => setShowSettings(true)} aria-label="Ajustes" style={{ color: "var(--text-2)", display: "grid", placeItems: "center", width: 32, height: 32 }}>
            <Icons.Settings size={20} />
          </button>
        </div>
      </div>

      {/* Header desktop */}
      <div className="desktop-header desktop-only">
        <div>
          <h1>Inicio</h1>
          <div className="subhead">{subhead}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="gps"><span className="gps-dot" />{locationIsReal ? "Ubicación precisa" : "Ubicación aproximada"}</span>
          <button onClick={() => setShowHowTo(true)} aria-label="Cómo usar" className="icon-btn sm" style={{ width: 40, height: 40 }}>
            <Icons.Help size={20} />
          </button>
          <ThemeToggle size={40} />
          <button onClick={() => setShowSettings(true)} aria-label="Ajustes" className="icon-btn sm" style={{ width: 40, height: 40 }}>
            <Icons.Settings size={20} />
          </button>
        </div>
      </div>

      {/* Acción principal — grande, claro, una sola cosa obvia. Para que cualquiera
          (incluido alguien que no usa apps) sepa qué tocar: "¿A dónde vas?". */}
      <button className="big-action" onClick={() => onTabChange("route")}>
        <span className="ba-icon"><Icons.Search size={24} /></span>
        <span className="ba-text">
          <span className="ba-title">¿A dónde querés ir?</span>
          <span className="ba-sub">Te decimos qué bus tomar y cuándo</span>
        </span>
        <Icons.Chevron size={20} />
      </button>

      {/* Selector de origen + Hero. El contador de abajo dice cuándo salir para
          tomar el próximo bus DESDE la parada elegida acá. */}
      <label className="source-label">¿Cuándo te tenés que ir?</label>
      {heroSources.length > 0 && (
        <div className="source-tabs">
          {heroSources.map((src, i) => (
            <button
              key={src.stopId}
              className={`source-tab ${i === heroIdx ? "active" : ""}`}
              onClick={() => setHeroIdx(i)}
            >
              <span className="emo">{src.alias ? aliasIcon(src.alias) : "📍"}</span>
              {src.alias ?? "Parada cercana"}
            </button>
          ))}
        </div>
      )}

      <div style={{ marginTop: 16, marginBottom: "var(--gap-section)" }}>
        {heroSource ? (
          <LeaveNowHero
            arrivals={heroArrivals}
            loading={heroLoading}
            walkMinutes={heroSource.walkMin}
            stopName={heroSource.stopName}
            stopAlias={heroSource.alias}
            onTap={() => setSheetStopId(heroSource.stopId)}
          />
        ) : (
          <button
            onClick={() => setShowRoutesManager(true)}
            className="hero-card"
            style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, borderStyle: "dashed", cursor: "pointer" }}
          >
            <div style={{ width: 44, height: 44, borderRadius: 14, background: "var(--accent-soft)", display: "grid", placeItems: "center", color: "var(--accent)" }}>
              <Icons.Star size={22} />
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ font: "var(--font-card)", color: "var(--text)" }}>Activá el contador</p>
              <p style={{ font: "var(--font-small)", color: "var(--text-3)", marginTop: 2 }}>Guardá una parada favorita o activá el GPS</p>
            </div>
          </button>
        )}
      </div>

      {/* Aviso de hora pico (solo dentro de la franja) */}
      <PeakHint />

      {/* Paradas cercanas (chips) */}
      {nearbyStops.length > 0 && (
        <>
          <div className="section-head">
            <h2>Paradas cercanas</h2>
            <button className="link" onClick={() => onTabChange("map")}>Ver en mapa <Icons.Chevron size={14} /></button>
          </div>
          <div className="stop-chip-row">
            {nearbyStops.slice(0, 6).map((stop) => {
              const dist = location && locationIsReal ? distanceTo(location.lat, location.lon, stop.stopLat, stop.stopLon) : null;
              return (
                <button
                  key={stop.stopId}
                  className={`stop-chip ${stop.stopId === activeStopId ? "active" : ""}`}
                  onClick={() => { setActiveStopId(stop.stopId); setSheetStopId(stop.stopId); }}
                >
                  <div className="name">{stop.stopName.split(" – ")[0]}</div>
                  <div className="meta">
                    {dist !== null && <><span>{distStr(dist)}</span><span className="pip" /></>}
                    <span>{stop.lines.length} líneas</span>
                  </div>
                </button>
              );
            })}
            <button className="stop-chip-end" onClick={() => onTabChange("map")}>Ver en mapa <Icons.Chevron size={14} /></button>
          </div>
        </>
      )}

      {/* Mis atajos */}
      {mounted && shortcuts.length > 0 && (
        <>
          <div className="section-head"><h2>Mis atajos</h2></div>
          <div className="shortcut-grid">
            {shortcuts.slice(0, 4).map((fav) => (
              <ShortcutCard
                key={fav.stopId}
                fav={fav}
                onTap={() => setSheetStopId(fav.stopId)}
                onLongPress={() => setEditingAlias({ stopId: fav.stopId, stopName: fav.stopName, alias: fav.alias })}
              />
            ))}
          </div>
        </>
      )}

      {/* Paradas favoritas (★) */}
      {mounted && otherFavs.length > 0 && (
        <>
          <div className="section-head"><h2>Paradas favoritas</h2><span className="link">{otherFavs.length}</span></div>
          <div className="list-stack">
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
        </>
      )}

      {/* Mis rutas */}
      {mounted && (
        <>
          <div className="section-head">
            <h2>Mis rutas</h2>
            <button className="link" onClick={() => setShowRoutesManager(true)}>
              {favorites.length > 0 ? "Editar" : <><Icons.Plus size={14} /> Agregar</>}
            </button>
          </div>
          {favorites.length > 0 ? (
            <div className="list-stack">
              {favorites.map((fav) => (
                <FavoriteRouteRow key={fav.id} route={fav} onTap={() => openFavorite(fav)} />
              ))}
            </div>
          ) : (
            <button onClick={() => setShowRoutesManager(true)} className="fav-row" style={{ borderStyle: "dashed", width: "100%", cursor: "pointer" }}>
              <span className="lead-icon" style={{ color: "var(--accent)" }}><Icons.Route size={18} /></span>
              <div className="text"><div className="meta" style={{ marginTop: 0 }}>Guardá tus rutas favoritas para acceso rápido</div></div>
            </button>
          )}
        </>
      )}

      {/* Acciones STM */}
      <div className="section-head"><h2>Acciones STM</h2></div>
      <div className="shortcut-grid">
        <a href="https://montevideo.gub.uy/stm-en-linea" target="_blank" rel="noopener noreferrer" className="shortcut-card tap-card">
          <div className="top">
            <span className="emo" style={{ background: "var(--live-soft)", color: "var(--live)" }}>💳</span>
            <span className="alias">Saldo STM</span>
          </div>
          <div className="nextline">Consultar y recargar</div>
        </a>
        <a href="https://montevideo.gub.uy/buzon-ciudadano" target="_blank" rel="noopener noreferrer" className="shortcut-card tap-card">
          <div className="top">
            <span className="emo" style={{ background: "var(--sched-soft)", color: "var(--sched)" }}>📣</span>
            <span className="alias">Reportar</span>
          </div>
          <div className="nextline">Buzón ciudadano IM</div>
        </a>
      </div>

      <div style={{ height: 28 }} />

      {/* Modales */}
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

      <AnimatePresence>
        {sheetStopId && <StopArrivalSheet stopId={sheetStopId} onClose={() => setSheetStopId(null)} />}
      </AnimatePresence>

      <AnimatePresence>
        {showRoutesManager && (
          <RoutesManager
            onClose={() => setShowRoutesManager(false)}
            onChange={() => setFavorites(getPrefs().favoriteRoutes)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSettings && <SettingsSheet onClose={() => setShowSettings(false)} />}
      </AnimatePresence>

      <AnimatePresence>
        {showHowTo && <HowToSheet onClose={() => setShowHowTo(false)} />}
      </AnimatePresence>
    </div>
  );
}

// ── Mis rutas: fila con próxima llegada real ──────────────────────────
function FavoriteRouteRow({ route, onTap }: { route: FavoriteRoute; onTap: () => void }) {
  // Ruta por dirección (origen→destino) vs ruta vieja por parada de salida.
  const isAddressRoute = route.toLat != null && route.toLon != null;
  const { arrivals, loading } = useArrivals(isAddressRoute ? "" : route.fromStop, 35000);
  const next = arrivals[0];
  const subtitle = isAddressRoute
    ? `${route.fromIsCurrentLocation ? "Mi ubicación" : (route.fromAddress || route.fromName)} → ${route.toAddress || route.toName}`
    : route.fromName;
  return (
    <button onClick={onTap} className="fav-row" style={{ width: "100%", cursor: "pointer" }}>
      <span className="lead-icon" style={{ fontSize: 18 }}>{route.emoji}</span>
      <div className="text">
        <div className="name">{route.name}</div>
        <div className="meta" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{subtitle}</div>
      </div>
      <div style={{ textAlign: "right", minWidth: 56 }}>
        {isAddressRoute ? (
          <span style={{ color: "var(--text-3)", display: "inline-flex" }}><Icons.Chevron size={18} /></span>
        ) : loading ? (
          <div className="skel" style={{ width: 44, height: 24, borderRadius: 8 }} />
        ) : next ? (
          <>
            <span className="eta tnum" style={{ color: next.eta <= 2 ? "var(--urgency-now)" : next.eta <= 8 ? "var(--accent)" : "var(--text)" }}>
              {formatEta(next.eta)}
            </span>
            {next.realtime && <span className="eta-unit" style={{ color: "var(--live)" }}> ●</span>}
          </>
        ) : (
          <span className="eta-unit">—</span>
        )}
      </div>
    </button>
  );
}

function getSubhead(date: Date, real: boolean): string {
  const dias = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const d = `${dias[date.getDay()]} ${date.getDate()} de ${meses[date.getMonth()]}`;
  const t = `${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")}`;
  return `${d} · ${t}${real ? " · ubicación precisa" : ""}`;
}

// ── ShortcutCard (Casa/Trabajo/Facu). Long-press edita alias ──────────
function ShortcutCard({ fav, onTap, onLongPress }: { fav: FavoriteStop; onTap: () => void; onLongPress: () => void }) {
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);

  const startPress = () => {
    longPressed.current = false;
    pressTimer.current = setTimeout(() => { longPressed.current = true; onLongPress(); }, 500);
  };
  const cancelPress = () => {
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; }
  };

  return (
    <button
      onClick={() => { if (!longPressed.current) onTap(); }}
      onMouseDown={startPress}
      onMouseUp={cancelPress}
      onMouseLeave={cancelPress}
      onTouchStart={startPress}
      onTouchEnd={cancelPress}
      onTouchCancel={cancelPress}
      onContextMenu={(e) => { e.preventDefault(); onLongPress(); }}
      className="shortcut-card tap-card"
    >
      <div className="top">
        <span className="emo">{aliasIcon(fav.alias)}</span>
        <span className="alias">{fav.alias}</span>
      </div>
      <div className="mid">
        {fav.lines.length > 0 ? (
          <>
            <LineBadge num={fav.lines[0]} size="sm" />
            <span className="nextline">{fav.lines.slice(0, 3).join(" · ")}{fav.lines.length > 3 ? ` +${fav.lines.length - 3}` : ""}</span>
          </>
        ) : (
          <span className="nextline">{fav.stopName}</span>
        )}
      </div>
    </button>
  );
}

// ── FavoriteStopRow (★ sin alias) ─────────────────────────────────────
function FavoriteStopRow({ fav, onTap, onRemove, onEditAlias }: {
  fav: FavoriteStop;
  onTap: () => void;
  onRemove: () => void;
  onEditAlias?: () => void;
}) {
  return (
    <div className="fav-row">
      <button onClick={onTap} style={{ flex: 1, display: "flex", alignItems: "center", gap: 13, textAlign: "left", minWidth: 0 }}>
        <span className="lead-icon" style={{ color: "var(--accent)" }}><Icons.Star size={17} filled /></span>
        <div className="text">
          <div className="name">{fav.alias || fav.stopName}</div>
          <div className="meta">
            #{fav.stopCode}
            {fav.lines.length > 0 && ` · ${fav.lines.slice(0, 6).join(" · ")}`}
            {fav.lines.length > 6 && ` · +${fav.lines.length - 6}`}
          </div>
        </div>
      </button>
      {onEditAlias && (
        <button onClick={(e) => { e.stopPropagation(); onEditAlias(); }} className="icon-btn sm" style={{ width: 32, height: 32 }} aria-label="Etiquetar">
          <Icons.Star size={14} />
        </button>
      )}
      <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="icon-btn sm" style={{ width: 32, height: 32 }} aria-label="Quitar de favoritos">
        <Icons.Close size={14} />
      </button>
    </div>
  );
}
