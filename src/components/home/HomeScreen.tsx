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
import LineDetailSheet from "@/components/home/LineDetailSheet";
import HomeMapPreview from "@/components/home/HomeMapPreview";
import RoutesManager from "@/components/home/RoutesManager";
import { track } from "@/lib/analytics";
import { LogoLockup } from "@/components/brand/Logo";
import { Icons } from "@/components/brand/Icons";
import PeakHint from "@/components/ui/PeakHint";
import SettingsSheet from "@/components/home/SettingsSheet";
import HowToSheet from "@/components/home/HowToSheet";
import SaldoSheet from "@/components/home/SaldoSheet";
import { setRouteInput } from "@/lib/route-input";
import { useServiceAlerts } from "@/hooks/useServiceAlerts";
import Tip from "@/components/ui/Tip";

type Tab = "home" | "route" | "map" | "search";

interface HomeScreenProps {
  onTabChange: (tab: Tab) => void;
}

function distStr(d: number | null): string {
  if (d === null) return "";
  return d < 1000 ? `${d} m` : `${(d / 1000).toFixed(1)} km`;
}

export default function HomeScreen({ onTabChange }: HomeScreenProps) {
  const { location, isReal: locationIsReal, status: locationStatus, retry: retryLocation } = useLocation();
  const { ready: stopsReady } = useStopsDataset();
  const [nearbyStops, setNearbyStops] = useState<BusStop[]>([]);
  const [activeStopId, setActiveStopId] = useState<string | null>(null);
  const [sheetStopId, setSheetStopId] = useState<string | null>(null);
  const [lineDetail, setLineDetail] = useState<{ line: string; destination?: string } | null>(null);
  const [showRoutesManager, setShowRoutesManager] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);
  const [showSaldo, setShowSaldo] = useState(false);
  const [favorites, setFavorites] = useState<FavoriteRoute[]>([]);
  const favoriteStops = useFavoriteStops();
  const alerts = useServiceAlerts();
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

  const shortcuts = useMemo(() => favoriteStops.filter((f) => !!f.alias), [favoriteStops]);

  // "Get me home/work" (Citymapper): un toque planifica la ruta desde tu ubicación
  // actual hasta la parada con alias Casa/Trabajo. Solo aparece si tenés esa parada
  // guardada. Resuelve el caso más común de un commuter: "llevame a casa ya".
  function goToFavorite(fav: FavoriteStop) {
    const stop = STOPS_DATASET.find((s) => s.stopId === fav.stopId);
    if (!stop) return;
    setRouteInput({
      to: { lat: stop.stopLat, lon: stop.stopLon, name: fav.stopName },
      fromCurrentLocation: true,
    });
    onTabChange("route");
  }
  const homeShortcut = shortcuts.find((f) => f.alias?.toLowerCase() === "casa");
  const workShortcut = shortcuts.find((f) => f.alias?.toLowerCase() === "trabajo");
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  // Hero "¿De dónde salís?": atajos (Casa/Trabajo) + parada más cercana.
  // Memoizado: sin esto se recalculaba en cada render (cada tick del reloj de 30s y
  // cada micro-update del GPS) creando objetos nuevos → el hero parpadeaba. Ahora solo
  // se recalcula si cambian las paradas o la ubicación de verdad (ya estabilizada).
  const [heroIdx, setHeroIdx] = useState(0);
  const heroSources = useMemo(() => {
    if (!mounted) return [];
    // atStop: la ubicación coincide con la parada (≤40 m) → "estás parado acá ahora".
    // Esto hace que la app se entienda sola: muestra los buses de DONDE ESTÁS sin pensar.
    return [
      ...shortcuts.slice(0, 2).map((f) => {
        const stopData = STOPS_DATASET.find((s) => s.stopId === f.stopId);
        const distM = location && stopData ? distanceTo(location.lat, location.lon, stopData.stopLat, stopData.stopLon) : null;
        return { stopId: f.stopId, stopName: f.stopName, alias: f.alias, walkMin: distM != null ? walkingMinutes(distM) : 5, atStop: distM != null && distM <= 40 };
      }),
      ...(nearbyStops.length > 0 && !shortcuts.some((s) => s.stopId === nearbyStops[0].stopId)
        ? [(() => {
            const distM = location && locationIsReal ? distanceTo(location.lat, location.lon, nearbyStops[0].stopLat, nearbyStops[0].stopLon) : null;
            return {
              stopId: nearbyStops[0].stopId,
              stopName: nearbyStops[0].stopName,
              alias: undefined as string | undefined,
              walkMin: distM != null ? walkingMinutes(distM) : 5,
              atStop: distM != null && distM <= 40,
            };
          })()]
        : []),
    ].sort((a, b) => Number(b.atStop) - Number(a.atStop)); // "estás acá" primero
  }, [mounted, shortcuts, nearbyStops, location, locationIsReal]);
  const atStopNow = heroSources.some((s) => s.atStop);
  const heroSource = heroSources[Math.min(heroIdx, heroSources.length - 1)] ?? null;

  useEffect(() => {
    setMounted(true);
    setNow(new Date());
    setFavorites(getPrefs().favoriteRoutes);
    const clockId = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(clockId);
  }, []);

  // Deep links: las landings SEO (/parada/3971, /linea/121) mandan a /?parada=… o
  // /?linea=… → acá se abre el sheet correspondiente. Así una URL compartida en
  // WhatsApp aterriza directo en la parada/línea, no en un home genérico. Después
  // limpiamos el query (replaceState) para que refrescar no reabra y la URL quede prolija.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const parada = sp.get("parada");
    const linea = sp.get("linea");
    if (parada) setSheetStopId(parada);
    else if (linea) setLineDetail({ line: linea });
    if (parada || linea) {
      window.history.replaceState(null, "", window.location.pathname);
      track("deep_link_open", { kind: parada ? "parada" : "linea" });
    }
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
          {/* El tema vive en Ajustes (Apariencia) — sacado del header para no competir con
              lo importante. Header = solo Ayuda + Ajustes. Menos ruido para gente grande. */}
          <button onClick={() => setShowHowTo(true)} aria-label="Cómo usar" className="icon-btn sm" style={{ width: 40, height: 40 }}>
            <Icons.Help size={20} />
          </button>
          <button onClick={() => setShowSettings(true)} aria-label="Ajustes" className="icon-btn sm" style={{ width: 40, height: 40 }}>
            <Icons.Settings size={20} />
          </button>
        </div>
      </div>

      {/* Preview del mapa: apenas abrís, ves TU zona (ubicación + paradas + buses). Un mapa
          se entiende más rápido que una lista. Tocar abre el mapa completo. */}
      <HomeMapPreview onOpen={() => onTabChange("map")} />

      {/* Incidencias oficiales (desvíos/obras): si hay, lo decimos ACÁ — te enterás sin
          buscar. Expandible para no robar protagonismo cuando no es urgente. */}
      {mounted && alerts.length > 0 && (
        <details className="home-alerts">
          <summary>
            <span className="ha-ico" aria-hidden><Icons.Warn size={15} /></span>
            <span className="ha-title">{alerts.length === 1 ? "Hay 1 aviso de desvíos" : `Hay ${alerts.length} avisos de desvíos`}</span>
            <Icons.Chevron size={15} />
          </summary>
          <div className="ha-body">
            {alerts.slice(0, 4).map((a) => (
              <div key={a.id} className="ha-item">
                <b>{a.title}</b>
                {a.body && <span>{a.body}</span>}
              </div>
            ))}
            <a href="/desvios" className="ha-all">Ver todos los desvíos →</a>
          </div>
        </details>
      )}

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

      {/* "Llevame a casa/trabajo" (Citymapper Get-me-home): un toque planifica la ruta
          desde tu ubicación. Solo si tenés esas paradas guardadas con alias. */}
      {(homeShortcut || workShortcut) && (
        <div className="quick-go-row">
          {homeShortcut && (
            <button className="quick-go" onClick={() => goToFavorite(homeShortcut)}>
              <span className="qg-emo">🏠</span>
              <span className="qg-txt"><b>A casa</b><span>desde acá</span></span>
            </button>
          )}
          {workShortcut && (
            <button className="quick-go" onClick={() => goToFavorite(workShortcut)}>
              <span className="qg-emo">💼</span>
              <span className="qg-txt"><b>A trabajo</b><span>desde acá</span></span>
            </button>
          )}
        </div>
      )}

      {/* Selector de origen + Hero. Si estás PARADO en una parada (≤40m), lo decimos
          derecho ("Estás en esta parada") y mostramos sus buses sin que toques nada. */}
      <label className="source-label">{atStopNow && heroSource?.atStop ? "Estás en esta parada" : "¿Cuándo te tenés que ir?"}</label>
      {heroSources.length > 0 && (
        <div className="source-tabs">
          {heroSources.map((src, i) => (
            <button
              key={src.stopId}
              className={`source-tab ${i === heroIdx ? "active" : ""}`}
              onClick={() => setHeroIdx(i)}
            >
              <span className="emo">{src.atStop ? "📍" : src.alias ? aliasIcon(src.alias) : "🚏"}</span>
              {src.atStop ? "Estás acá" : src.alias ?? "Parada cercana"}
            </button>
          ))}
        </div>
      )}

      <div style={{ marginTop: 16, marginBottom: "var(--gap-section)" }}>
        {heroSource && (
          <Tip id="leave-now">Te decimos <b>cuándo salir</b> para llegar justo a la parada, sin esperar de gusto.</Tip>
        )}
        {heroSource ? (
          <LeaveNowHero
            arrivals={heroArrivals}
            loading={heroLoading}
            walkMinutes={heroSource.walkMin}
            stopName={heroSource.stopName}
            stopAlias={heroSource.alias}
            atStop={heroSource.atStop}
            onTap={() => setSheetStopId(heroSource.stopId)}
          />
        ) : (!mounted || !stopsReady || locationStatus === "pending") ? (
          /* CARGANDO: skeleton del hero en vez de un empty state seco. Da sensación de
             velocidad — el usuario ve que "ya viene" en vez de un cartel de tarea. */
          <div className="hero-card skel" style={{ minHeight: 168 }} aria-label="Buscando tu parada más cercana" />
        ) : (
          /* SIN GPS / sin parada: CTA cálido y deseable (no "activá el contador" como to-do).
             Primera impresión = invitar, no mandar tarea. Un toque activa la ubicación. */
          <button
            onClick={() => retryLocation()}
            className="hero-card"
            style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, cursor: "pointer", background: "radial-gradient(120% 100% at 50% 0%, rgba(240,160,32,0.10), transparent 70%)" }}
          >
            <div style={{ width: 52, height: 52, borderRadius: "var(--r-card)", background: "var(--accent)", display: "grid", placeItems: "center", color: "#1a1206" }}>
              <Icons.Crosshair size={26} />
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ font: "700 17px/1.2 var(--ff)", color: "var(--text)" }}>Mostrame mi próximo bus</p>
              <p style={{ font: "var(--font-small)", color: "var(--text-2)", marginTop: 4, maxWidth: 240 }}>Activá la ubicación y te digo cuándo salir, al instante.</p>
            </div>
          </button>
        )}
      </div>

      {/* Aviso de hora pico (solo dentro de la franja) */}
      <PeakHint />

      {/* Paradas cercanas (chips). Si estás PARADO en una parada, estas son ALTERNATIVAS:
          "si tu bus no para acá, mirá estas otras a pocos metros". */}
      {nearbyStops.length > (atStopNow ? 1 : 0) && (
        <>
          <div className="section-head">
            <h2>{atStopNow ? "Otras paradas cerca" : "Paradas cercanas"}</h2>
            <button className="link" onClick={() => onTabChange("map")}>Ver en mapa <Icons.Chevron size={14} /></button>
          </div>
          <div className="stop-chip-row">
            {nearbyStops.slice(atStopNow ? 1 : 0, atStopNow ? 7 : 6).map((stop) => {
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
                    <span>{stop.lines.length} {stop.lines.length === 1 ? "línea" : "líneas"}</span>
                  </div>
                </button>
              );
            })}
            <button className="stop-chip-end" onClick={() => onTabChange("map")}>Ver en mapa <Icons.Chevron size={14} /></button>
          </div>
        </>
      )}

      {/* NOTA: la sección "Mis atajos" se eliminó — duplicaba los favoritos con alias
          (Casa/Trabajo) que ya aparecen arriba como source-tabs (cambian el contador) y
          como botones "A casa/A trabajo" (planifican la ruta). Mostrar el mismo dato 3
          veces era complejidad innecesaria. Editar alias se hace desde "Paradas favoritas". */}

      {/* Paradas favoritas — TODAS (con alias Casa/Trabajo y sin alias). Antes solo
          mostraba las sin-alias porque las otras estaban en "Mis atajos"; al eliminar esa
          sección, acá viven todas (editar/borrar incluido). */}
      {mounted && favoriteStops.length > 0 && (
        <>
          <div className="section-head"><h2>Paradas favoritas</h2><span className="link">{favoriteStops.length}</span></div>
          <div className="list-stack">
            {favoriteStops.slice(0, 6).map((fav) => (
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
        <button onClick={() => { setShowSaldo(true); track("open_saldo_stm"); }} className="shortcut-card tap-card" style={{ textAlign: "left" }}>
          <div className="top">
            <span className="emo" style={{ background: "var(--live-soft)", color: "var(--live)" }}>💳</span>
            <span className="alias">Saldo STM</span>
          </div>
          <div className="nextline">Consultar y recargar</div>
        </button>
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
        {lineDetail && <LineDetailSheet line={lineDetail.line} destination={lineDetail.destination} onClose={() => setLineDetail(null)} />}
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

      <AnimatePresence>
        {showSaldo && <SaldoSheet onClose={() => setShowSaldo(false)} />}
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

// ── FavoriteStopRow (paradas favoritas, con o sin alias) ──────────────
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
