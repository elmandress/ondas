"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "@/hooks/useLocation";
import { useStopsDataset } from "@/hooks/useStopsDataset";
import { STOPS_DATASET } from "@/lib/stm";
import { planRoutes, type RouteCandidate } from "@/lib/route-planner";
import { walkingMinutes, distanceTo } from "@/lib/utils";
import StopArrivalSheet from "@/components/home/StopArrivalSheet";
import { useSelectedPlace, setSelectedPlace } from "@/lib/selected-place";
import { useWalkingSteps } from "@/hooks/useWalkingSteps";
import { useRoutePlanner, type PlannedRouteDto, type RouteLegDto } from "@/hooks/useRouteplanner";
import { setSelectedRoute } from "@/lib/selected-route";
import { setActiveTab } from "@/lib/active-tab";
import { fareLabel } from "@/lib/fare";
import { tripImpactLabel } from "@/lib/trip-impact";
import { SERVICE_ALERT_SOURCES } from "@/lib/service-alerts";
import { shareTrip } from "@/lib/share-trip";
import { useRouteInput, setRouteInput } from "@/lib/route-input";
import { useNextArrivalForLine } from "@/hooks/useNextArrivalForLine";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { LogoLockup } from "@/components/brand/Logo";
import { Icons } from "@/components/brand/Icons";
import VoiceOverlay from "@/components/ui/VoiceOverlay";
import LineBadge from "@/components/ui/LineBadge";
import MixedTripOption from "@/components/route/MixedTripOption";
import { useMounted } from "@/hooks/useMounted";

interface Place { name: string; subtitle?: string; lat: number; lon: number; icon?: string; }

const HISTORY_KEY = "ondas_route_history";
const MAX_HISTORY = 6;

export default function RouteScreen() {
  const { location } = useLocation();
  const { ready: stopsReady } = useStopsDataset();
  const selectedPlace = useSelectedPlace();
  const [from, setFrom] = useState<Place | null>(null);
  const [to, setTo] = useState<Place | null>(null);
  // Paradas intermedias (hasta 3). El input activo de un waypoint se identifica como `wp-${i}`.
  const [waypoints, setWaypoints] = useState<Place[]>([]);
  const [activeInput, setActiveInput] = useState<"from" | "to" | `wp-${number}` | null>(null);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [sheetStopId, setSheetStopId] = useState<string | null>(null);
  const [history, setHistory] = useState<Place[]>([]);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const mounted = useMounted();
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const voice = useVoiceInput({
    onResult: (transcript) => {
      setQuery(transcript);
      setVoiceError(null);
    },
    onError: (msg) => {
      setVoiceError(msg);
      setTimeout(() => setVoiceError(null), 3000);
    },
  });

  // Cargar historial
  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) setHistory(JSON.parse(raw));
    } catch {}
  }, []);

  function saveToHistory(place: Place) {
    const filtered = history.filter((p) => p.name !== place.name);
    const updated = [place, ...filtered].slice(0, MAX_HISTORY);
    setHistory(updated);
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(updated)); } catch {}
  }

  // Inicializar "Desde" con ubicación actual
  useEffect(() => {
    if (location && !from) {
      setFrom({ name: "Mi ubicación", subtitle: "Posición actual", lat: location.lat, lon: location.lon });
    }
  }, [location, from]);

  // FR-3.8 ↔ FR-4: si el usuario llegó acá con un lugar pre-seleccionado (desde el buscador),
  // usar ese lugar como destino. Después limpiamos el selectedPlace para no resetear si vuelve.
  useEffect(() => {
    if (selectedPlace) {
      setTo({
        name: selectedPlace.name,
        subtitle: selectedPlace.fullName?.split(",").slice(1, 3).join(",").trim(),
        lat: selectedPlace.lat,
        lon: selectedPlace.lon,
      });
      setSelectedPlace(null);
    }
  }, [selectedPlace]);

  // FR-4.1: pre-cargar desde el mapa (slot único) o desde una ruta guardada (from+to)
  const routeInput = useRouteInput();
  useEffect(() => {
    if (!routeInput) return;
    // Modo ruta completa (Mis rutas guardadas): origen + destino a la vez.
    if (routeInput.from || routeInput.to || routeInput.fromCurrentLocation) {
      if (routeInput.fromCurrentLocation && location) {
        setFrom({ name: "Mi ubicación", subtitle: "Posición actual", lat: location.lat, lon: location.lon });
      } else if (routeInput.from) {
        setFrom({ name: routeInput.from.name || "Origen", lat: routeInput.from.lat, lon: routeInput.from.lon });
      }
      if (routeInput.to) setTo({ name: routeInput.to.name || "Destino", lat: routeInput.to.lat, lon: routeInput.to.lon });
      setRouteInput(null);
      return;
    }
    // Modo single-slot (long-press del mapa).
    if (routeInput.point) {
      const place = { name: routeInput.point.name || "Punto en el mapa", lat: routeInput.point.lat, lon: routeInput.point.lon };
      if (routeInput.slot === "from") setFrom(place);
      else setTo(place);
    }
    setRouteInput(null);
  }, [routeInput, location]);

  // Búsqueda de lugares + paradas
  useEffect(() => {
    if (!activeInput || !query.trim()) {
      setSuggestions([]);
      return;
    }
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(async () => {
      setSearching(true);
      const q = query.trim().toLowerCase();
      // 1. Paradas locales que matcheen
      const stopMatches: Place[] = stopsReady
        ? STOPS_DATASET
            .filter((s) => s.stopName.toLowerCase().includes(q) || s.stopCode.includes(q))
            .slice(0, 5)
            .map((s) => ({
              name: s.stopName,
              subtitle: `Parada #${s.stopCode}`,
              lat: s.stopLat,
              lon: s.stopLon,
            }))
        : [];

      // 2. Lugares vía Nominatim
      let placeMatches: Place[] = [];
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          placeMatches = (data.results || []).slice(0, 5).map((r: { name: string; fullName?: string; lat: number; lon: number; icon?: string }) => ({
            name: r.name,
            subtitle: r.fullName ? r.fullName.split(",").slice(1, 3).join(",").trim() : undefined,
            lat: r.lat,
            lon: r.lon,
            icon: r.icon,
          }));
        }
      } catch {}

      setSuggestions([...stopMatches, ...placeMatches]);
      setSearching(false);
    }, 250);

    return () => { if (debRef.current) clearTimeout(debRef.current); };
  }, [query, activeInput, stopsReady]);

  function pickPlace(place: Place) {
    if (activeInput === "from") setFrom(place);
    else if (activeInput === "to") setTo(place);
    else if (typeof activeInput === "string" && activeInput.startsWith("wp-")) {
      const i = Number(activeInput.slice(3));
      setWaypoints((ws) => ws.map((w, idx) => (idx === i ? place : w)));
    }
    saveToHistory(place);
    setActiveInput(null);
    setQuery("");
    setSuggestions([]);
  }

  function addWaypoint() {
    if (waypoints.length >= 3) return;
    const i = waypoints.length;
    // Placeholder vacío que el usuario completa; abrimos su búsqueda enseguida.
    setWaypoints((ws) => [...ws, { name: "", lat: 0, lon: 0 }]);
    setActiveInput(`wp-${i}`);
    setQuery("");
  }

  function removeWaypoint(i: number) {
    setWaypoints((ws) => ws.filter((_, idx) => idx !== i));
    if (activeInput === `wp-${i}`) { setActiveInput(null); setQuery(""); }
  }

  // Solo los waypoints con coordenadas reales (completados) van al planner.
  const validWaypoints = waypoints.filter((w) => w.lat !== 0 || w.lon !== 0);

  function swap() {
    const tmp = from;
    setFrom(to);
    setTo(tmp);
  }

  // FR-4.6: validación origen/destino fuera del área de cobertura STM.
  // Devuelve no solo si está fuera, sino CUÁL está fuera y dónde.
  // Bbox amplio: MVD + Ciudad de la Costa + Las Piedras + La Paz + Pando + Atlántida.
  const areaCheck = useMemo(() => classifyArea(from, to), [from, to]);
  const outOfArea = areaCheck.kind !== "ok";

  // Hora de salida: null = "salir ahora". Si el usuario elige una hora, planificamos
  // las ETAs/esperas respecto a esa hora futura (schedule-aware).
  const [departAt, setDepartAt] = useState<string | null>(null);

  // Router GTFS (server) — fuente principal
  const { routes: gtfsRoutes, loading: gtfsLoading } = useRoutePlanner(
    from, to, !!from && !!to && !outOfArea, departAt,
    validWaypoints.map((w) => ({ lat: w.lat, lon: w.lon, name: w.name }))
  );
  const usingGtfs = gtfsRoutes.length > 0;

  // "Optimizar para" — re-rankea las rutas REALES que ya devolvió el motor (cliente,
  // instantáneo). maprab confesó que sus optimizaciones no andaban; las nuestras sí.
  const [optimize, setOptimize] = useState<"fast" | "transfers" | "walk">("fast");
  const sortedRoutes = useMemo(() => {
    const walkS = (r: PlannedRouteDto) => r.legs.reduce((s, l) => s + (l.type === "walk" ? l.durationS : 0), 0);
    const arr = [...gtfsRoutes];
    if (optimize === "transfers") arr.sort((a, b) => a.numTransfers - b.numTransfers || a.totalSeconds - b.totalSeconds);
    else if (optimize === "walk") arr.sort((a, b) => walkS(a) - walkS(b) || a.totalSeconds - b.totalSeconds);
    else arr.sort((a, b) => a.totalSeconds - b.totalSeconds);
    return arr;
  }, [gtfsRoutes, optimize]);

  // Heurística legacy SOLO como fallback cuando GTFS terminó y no devolvió nada.
  // CLAVE: planRoutes itera ~5000 paradas de forma SÍNCRONA y bloquea el hilo principal.
  // Si la computábamos siempre (incluso en el camino feliz con GTFS), la UI se "trancaba"
  // al elegir destino. Ahora solo corre cuando de verdad hace falta.
  const needHeuristic = !!from && !!to && stopsReady && !outOfArea && !gtfsLoading && gtfsRoutes.length === 0;
  const heuristicRoutes = useMemo<RouteCandidate[]>(() => {
    if (!needHeuristic) return [];
    return planRoutes(STOPS_DATASET, from!, to!, { walkRadiusM: 1500, maxCandidates: 6 });
  }, [needHeuristic, from, to]);

  const routes = usingGtfs ? [] : heuristicRoutes;

  const showSuggestions = activeInput !== null;

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--bg)", paddingTop: "max(env(safe-area-inset-top), 8px)" }}>
      {/* Header mobile */}
      <div className="app-header mobile-only" style={{ paddingLeft: 0, paddingRight: 0 }}>
        <LogoLockup size={24} ring="var(--text)" dot="var(--accent)" />
        <span className="gps-dot" aria-label="GPS activo" />
      </div>
      {/* Header desktop */}
      <div className="desktop-header desktop-only">
        <div>
          <h1>Rutas</h1>
          <div className="subhead">Encontrá la forma más rápida de llegar a cualquier lugar</div>
        </div>
      </div>

      {/* Inputs origen / destino */}
      <header className="flex-shrink-0">
        <div className="input-card">
          <PlaceInput
            label="Desde"
            place={from}
            active={activeInput === "from"}
            kind="from"
            onFocus={() => { setActiveInput("from"); setQuery(""); }}
            onClear={() => setFrom(null)}
          />
          {waypoints.map((w, i) => (
            <PlaceInput
              key={`wp-${i}`}
              label={`Pasar por ${waypoints.length > 1 ? i + 1 : ""}`.trim()}
              place={w.lat !== 0 || w.lon !== 0 ? w : null}
              active={activeInput === `wp-${i}`}
              kind="waypoint"
              onFocus={() => { setActiveInput(`wp-${i}`); setQuery(""); }}
              onClear={() => removeWaypoint(i)}
            />
          ))}
          <PlaceInput
            label="Hacia"
            place={to}
            active={activeInput === "to"}
            kind="to"
            onFocus={() => { setActiveInput("to"); setQuery(""); }}
            onClear={() => setTo(null)}
          />
          <button className="swap-btn" onClick={swap} aria-label="Invertir origen y destino">
            <Icons.Swap size={14} />
          </button>
        </div>

        <DepartTimePicker value={departAt} onChange={setDepartAt}>
          {waypoints.length < 3 && (
            <button className="depart-chip" onClick={addWaypoint} aria-label="Agregar parada intermedia">
              <Icons.Plus size={14} /> Parada
            </button>
          )}
        </DepartTimePicker>
      </header>

      {/* Suggestions o resultados */}
      <div className="flex-1 overflow-y-auto pb-4 scrollbar-none" style={{ marginTop: 16 }}>
        <AnimatePresence mode="wait">
          {showSuggestions ? (
            <motion.div key="search" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
              <div className="card-soft px-3 py-2 flex items-center gap-2">
                <svg className="w-4 h-4 text-slate-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={activeInput === "from" ? "Desde dónde…" : "A dónde vas…"}
                  className="flex-1 bg-transparent outline-none text-body text-white placeholder:text-slate-600"
                />
                {mounted && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!voice.supported) {
                        setVoiceError("Tu navegador bloquea la voz. Probá en Chrome 🙏");
                        setTimeout(() => setVoiceError(null), 4500);
                        return;
                      }
                      if (voice.state === "listening") voice.stop(); else voice.start();
                    }}
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
                    style={{
                      background: voice.state === "listening"
                        ? "rgba(239,68,68,0.2)"
                        : "rgba(255,255,255,0.05)",
                    }}
                    aria-label={voice.state === "listening" ? "Detener grabación" : "Buscar por voz"}
                  >
                    {voice.state === "listening" ? (
                      <svg className="w-3.5 h-3.5 text-red-400 animate-pulse" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="6" y="6" width="12" height="12" rx="2"/>
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                        <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/>
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                        <line x1="12" y1="19" x2="12" y2="23"/>
                        <line x1="8" y1="23" x2="16" y2="23"/>
                      </svg>
                    )}
                  </button>
                )}
                <button onClick={() => { setActiveInput(null); setQuery(""); voice.stop(); }} className="text-xs text-amber-400 font-semibold flex-shrink-0">Cancelar</button>
              </div>
              {/* Toast de error de voz */}
              <AnimatePresence>
                {voiceError && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-[11px] text-red-400 px-1"
                  >
                    {voiceError}
                  </motion.p>
                )}
              </AnimatePresence>

              {/* Mi ubicación rápida si activeInput=from y hay location */}
              {activeInput === "from" && location && !query && (
                <button
                  onClick={() => pickPlace({ name: "Mi ubicación", subtitle: "Posición actual", lat: location.lat, lon: location.lon })}
                  className="w-full card-soft px-3 py-3 flex items-center gap-3 text-left"
                >
                  <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "var(--accent-soft)" }}>
                    <svg className="w-4 h-4 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-body font-semibold text-white">Mi ubicación</p>
                    <p className="text-xs text-slate-500">Usar GPS actual</p>
                  </div>
                </button>
              )}

              {/* Atajo: elegir punto en el mapa con long-press (FR-4.1) */}
              {!query && (
                <button
                  onClick={() => {
                    setActiveInput(null);
                    setActiveTab("map");
                  }}
                  className="w-full card-soft px-3 py-3 flex items-center gap-3 text-left"
                >
                  <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "rgba(168,85,247,0.15)" }}>
                    <svg className="w-4 h-4 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-body font-semibold text-white">Elegir en el mapa</p>
                    <p className="text-xs text-slate-500">Mantené apretado un punto del mapa</p>
                  </div>
                </button>
              )}

              {/* Historial */}
              {!query && history.length > 0 && (
                <>
                  <div className="search-section-title">Recientes</div>
                  {history.map((h, i) => (
                    <button key={i} onClick={() => pickPlace(h)} className="search-result">
                      <div className="icon"><Icons.Clock size={16} /></div>
                      <div className="body">
                        <div className="name">{h.name}</div>
                        {h.subtitle && <div className="meta">{h.subtitle}</div>}
                      </div>
                      <Icons.Chevron size={16} />
                    </button>
                  ))}
                </>
              )}

              {/* Resultados de búsqueda */}
              {searching && (
                <p className="text-xs text-slate-500 text-center py-3">Buscando…</p>
              )}
              {!searching && query && suggestions.length === 0 && (
                <p className="text-xs text-slate-500 text-center py-6">Sin resultados</p>
              )}
              {suggestions.length > 0 && (
                <>
                  {suggestions.map((s, i) => {
                    const isStop = s.subtitle?.startsWith("Parada");
                    return (
                    <button key={i} onClick={() => pickPlace(s)} className={`search-result ${isStop ? "stop" : "place"}`}>
                      <div className="icon">{s.icon ? <span style={{ fontSize: 18 }}>{s.icon}</span> : isStop ? <Icons.Bus size={16} /> : <Icons.Pin size={16} />}</div>
                      <div className="body">
                        <div className="name">{s.name}</div>
                        {s.subtitle && <div className="meta">{s.subtitle}</div>}
                      </div>
                      <Icons.Chevron size={16} />
                    </button>
                    );
                  })}
                </>
              )}
            </motion.div>
          ) : (
            <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              {!from || !to ? (
                <EmptyState />
              ) : outOfArea ? (
                <OutOfAreaState
                  info={areaCheck}
                  destName={to?.name}
                  onPlanToTerminal={() => setTo({ name: "Terminal Tres Cruces", subtitle: "Bv. Artigas y Av. Italia", lat: -34.8941, lon: -56.1640 })}
                />
              ) : !stopsReady ? (
                <p className="text-center text-slate-500 text-sm py-12">Cargando paradas…</p>
              ) : gtfsLoading ? (
                <p className="text-center text-slate-500 text-sm py-12">Buscando el mejor bondi…</p>
              ) : usingGtfs ? (
                <>
                  <p className="text-eyebrow mt-1">
                    {gtfsRoutes.length} {gtfsRoutes.length === 1 ? "opción" : "opciones"} · datos oficiales STM
                  </p>
                  {gtfsRoutes.length > 1 && (
                    <div className="opt-row">
                      {([["fast", "Más rápido"], ["transfers", "Menos transbordos"], ["walk", "Menos caminata"]] as const).map(([k, label]) => (
                        <button key={k} className={`opt-chip ${optimize === k ? "on" : ""}`} onClick={() => setOptimize(k)} aria-pressed={optimize === k}>
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                  {sortedRoutes.map((r, i) => (
                    <GtfsRouteCard
                      key={r.signature || i}
                      route={r}
                      destinationName={to?.name}
                      onTapStop={(id) => setSheetStopId(id)}
                      onShowOnMap={() => {
                        if (!from || !to) return;
                        setSelectedRoute({
                          route: r,
                          origin: { lat: from.lat, lon: from.lon, name: from.name },
                          destination: { lat: to.lat, lon: to.lon, name: to.name },
                        });
                        setActiveTab("map");
                      }}
                    />
                  ))}
                  <ServiceAlertsNote />
                </>
              ) : routes.length === 0 ? (
                <NoRoutesState from={from} to={to} />
              ) : (
                <>
                  {/* Fallback heurístico cuando GTFS no devuelve resultados */}
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl mb-1"
                       style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.18)" }}>
                    <svg className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <p className="text-[10px] text-amber-300/90 leading-tight">
                      <span className="font-bold">Estimación aproximada.</span> Usá las llegadas en vivo en cada parada para confirmar.
                    </p>
                  </div>
                  <p className="text-eyebrow mt-1">{routes.length} {routes.length === 1 ? "opción" : "opciones"} disponibles</p>
                  {routes.map((r, i) => (
                    <RouteCard
                      key={i}
                      route={r}
                      origin={from!}
                      destination={to!}
                      onTapStop={(id) => setSheetStopId(id)}
                    />
                  ))}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {sheetStopId && (
          <StopArrivalSheet stopId={sheetStopId} onClose={() => setSheetStopId(null)} />
        )}
      </AnimatePresence>

      <VoiceOverlay open={voice.state === "listening"} onCancel={() => voice.stop()} hint='Decí el destino — ej. "Pocitos" o "Tres Cruces"' />
    </div>
  );
}

function PlaceInput({
  label, place, active, kind, onFocus, onClear,
}: { label: string; place: Place | null; active: boolean; kind: "from" | "to" | "waypoint"; onFocus: () => void; onClear: () => void; }) {
  const lead = kind === "from" ? <Icons.Crosshair size={16} /> : kind === "waypoint" ? <Icons.Clock size={15} /> : <Icons.Pin size={16} />;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onFocus}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onFocus(); }}
      className={`input-row ${kind}`}
      style={active ? { background: "var(--accent-soft)", borderRadius: 12, marginInline: -8, paddingInline: 8 } : undefined}
    >
      <span className="lead">{lead}</span>
      <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
        <div className="eyebrow" style={{ marginBottom: 1 }}>{label || "Pasar por"}</div>
        {place ? (
          <p style={{ font: "600 16px/1.2 var(--ff)", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{place.name}</p>
        ) : (
          <p style={{ font: "500 15px/1.2 var(--ff)", color: "var(--text-3)" }}>{kind === "waypoint" ? "Elegí una parada intermedia" : "Tocá para elegir"}</p>
        )}
      </div>
      {/* Pista de que es editable: lápiz cuando hay valor (tocá para cambiar). */}
      {place && (
        <span className="edit-hint" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        </span>
      )}
      {(place || kind === "waypoint") && (
        <button className="clear" onClick={(e) => { e.stopPropagation(); onClear(); }} aria-label={kind === "waypoint" ? "Quitar parada" : "Limpiar"}>×</button>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center text-center py-16 px-6">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: "var(--accent-soft)" }}>
        <svg className="w-8 h-8 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 11 22 2 13 21 11 13 3 11" />
        </svg>
      </div>
      <h3 className="text-headline mb-1">Planificá tu viaje</h3>
      <p className="text-body text-slate-500">Ingresá origen y destino para ver qué buses tomar</p>
    </div>
  );
}

function NoRoutesState({ from, to }: { from: Place; to: Place }) {
  // SRS FR-4.8: mensaje útil con paradas cercanas a AMBOS puntos.
  const fromStops = useMemo(() => {
    return STOPS_DATASET
      .map(s => ({ s, d: distanceTo(from.lat, from.lon, s.stopLat, s.stopLon) }))
      .filter(x => x.d <= 800)
      .sort((a, b) => a.d - b.d)
      .slice(0, 3);
  }, [from]);

  const toStops = useMemo(() => {
    return STOPS_DATASET
      .map(s => ({ s, d: distanceTo(to.lat, to.lon, s.stopLat, s.stopLon) }))
      .filter(x => x.d <= 800)
      .sort((a, b) => a.d - b.d)
      .slice(0, 3);
  }, [to]);

  const directDist = distanceTo(from.lat, from.lon, to.lat, to.lon);

  return (
    <div className="flex flex-col py-8 px-4">
      <div className="flex items-center gap-3 mb-4 px-2">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "var(--surface)" }}>
          <svg className="w-5 h-5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-headline">No encontramos una ruta directa</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {directDist < 1000 ? "Está muy cerca, considerá caminar." : `Distancia directa: ${(directDist/1000).toFixed(1)} km.`}
            {" "}Tocá una parada para ver llegadas o probá otro destino.
          </p>
        </div>
      </div>

      {fromStops.length > 0 && (
        <div className="w-full text-left mb-4">
          <p className="text-eyebrow mb-2">Paradas cerca del origen</p>
          <div className="space-y-1.5">
            {fromStops.map(({ s, d }) => (
              <div key={s.stopId} className="card-soft p-2.5 flex justify-between items-center">
                <div className="min-w-0 flex-1 pr-2">
                  <p className="text-sm font-semibold text-white truncate">{s.stopName}</p>
                  <p className="text-[11px] text-slate-500">{d}m · {s.lines.length} líneas</p>
                </div>
                <div className="flex gap-1 flex-wrap justify-end max-w-[50%]">
                  {s.lines.slice(0, 3).map(l => (
                     <span key={l} className="text-[10px] font-black px-1.5 py-0.5 rounded text-white"
                     style={{ background: "rgba(255,255,255,0.08)", border: "1px solid var(--border-strong)" }}>{l}</span>
                  ))}
                  {s.lines.length > 3 && <span className="text-[10px] text-slate-500">+{s.lines.length - 3}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {toStops.length > 0 && (
        <div className="w-full text-left">
          <p className="text-eyebrow mb-2">Paradas cerca del destino</p>
          <div className="space-y-1.5">
            {toStops.map(({ s, d }) => (
              <div key={s.stopId} className="card-soft p-2.5 flex justify-between items-center">
                <div className="min-w-0 flex-1 pr-2">
                  <p className="text-sm font-semibold text-white truncate">{s.stopName}</p>
                  <p className="text-[11px] text-slate-500">{d}m · {s.lines.length} líneas</p>
                </div>
                <div className="flex gap-1 flex-wrap justify-end max-w-[50%]">
                  {s.lines.slice(0, 3).map(l => (
                     <span key={l} className="text-[10px] font-black px-1.5 py-0.5 rounded text-white"
                     style={{ background: "rgba(255,255,255,0.08)", border: "1px solid var(--border-strong)" }}>{l}</span>
                  ))}
                  {s.lines.length > 3 && <span className="text-[10px] text-slate-500">+{s.lines.length - 3}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {fromStops.length === 0 && toStops.length === 0 && (
        <p className="text-body text-slate-500 text-center mt-2">
          No hay paradas STM cerca. Probá un punto más cercano al centro de Montevideo.
        </p>
      )}
    </div>
  );
}

function RouteCard({
  route, origin, destination, onTapStop,
}: {
  route: RouteCandidate;
  origin: Place;
  destination: Place;
  onTapStop: (id: string) => void;
}) {
  const isWalk = route.type === "walk";
  const isTransfer = route.type === "transfer";
  const totalMin = route.estimatedMinutes;
  const [expanded, setExpanded] = useState(false);

  // SRS FR-4.3 + FR-4.9: pasos peatonales reales con calles (OSRM).
  // Solo se piden cuando el usuario expande la opción (lazy).
  const walkFromTo = isWalk
    ? { from: origin, to: destination }
    : route.fromStop
    ? { from: origin, to: { lat: route.fromStop.stopLat, lon: route.fromStop.stopLon } }
    : null;
  const walkToFrom = !isWalk && route.toStop
    ? { from: { lat: route.toStop.stopLat, lon: route.toStop.stopLon }, to: destination }
    : null;

  const { route: walkInitial } = useWalkingSteps(walkFromTo?.from || null, walkFromTo?.to || null, expanded);
  const { route: walkFinal } = useWalkingSteps(walkToFrom?.from || null, walkToFrom?.to || null, expanded);

  // Tiempo del tramo peatonal corregido por OSRM (si llegó)
  const realWalkFromMin = walkInitial ? Math.max(1, Math.round(walkInitial.durationS / 60)) : walkingMinutes(route.walkFromMeters);
  const realWalkToMin = isWalk
    ? 0
    : walkFinal
    ? Math.max(1, Math.round(walkFinal.durationS / 60))
    : walkingMinutes(route.walkToMeters || 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="card overflow-hidden"
    >
      <button onClick={() => setExpanded((e) => !e)} className="w-full text-left">
        <div className="px-4 pt-3.5 pb-3 flex items-center justify-between">
          <div>
            <p className="text-eyebrow mb-0.5">Opción {isWalk ? "Caminando" : isTransfer ? "Transbordo" : "Directa"}</p>
            <p className="text-headline">~{totalMin} min total</p>
          </div>
          {!isWalk && !isTransfer && (
            <div className="flex gap-1 flex-wrap justify-end max-w-[60%]">
              {route.sharedLines.slice(0, 4).map((l) => (
                <span key={l} className="text-[11px] font-black px-2 py-1 rounded-md text-white"
                  style={{ background: "rgba(255,255,255,0.08)", border: "1px solid var(--border-strong)", letterSpacing: "-0.02em" }}>
                  {l}
                </span>
              ))}
              {route.sharedLines.length > 4 && (
                <span className="text-[11px] text-slate-500 font-semibold self-center">+{route.sharedLines.length - 4}</span>
              )}
            </div>
          )}
          {isTransfer && (
            <div className="flex items-center gap-1.5 justify-end">
              <span className="text-[11px] font-black px-2 py-1 rounded-md text-white" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid var(--border-strong)" }}>{route.transferLine1}</span>
              <svg className="w-3 h-3 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><polyline points="9 18 15 12 9 6" /></svg>
              <span className="text-[11px] font-black px-2 py-1 rounded-md text-white" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid var(--border-strong)" }}>{route.transferLine2}</span>
            </div>
          )}
        </div>
      </button>

      <div className="divider" />

      {/* Pasos resumidos */}
      <div className="px-4 py-3 space-y-2.5">
        {isWalk ? (
          <WalkingSection minutes={realWalkFromMin} meters={route.walkFromMeters} steps={expanded ? walkInitial?.steps : undefined} fallbackLabel="hasta el destino" />
        ) : isTransfer ? (
          <>
            <WalkingSection minutes={realWalkFromMin} meters={route.walkFromMeters} steps={expanded ? walkInitial?.steps : undefined} fallbackLabel="hasta la parada" />
            <button onClick={() => onTapStop(route.fromStop!.stopId)} className="w-full text-left">
              <Step icon="bus" main={`Tomá el ${route.transferLine1}`} sub={`Desde ${route.fromStop!.stopName}`} action="Llegadas" />
            </button>
            <button onClick={() => onTapStop(route.transferStop!.stopId)} className="w-full text-left">
              <Step icon="stop" main="Bajate en" sub={route.transferStop!.stopName} action="Ver parada" />
            </button>
            <button onClick={() => onTapStop(route.transferStop!.stopId)} className="w-full text-left">
              <Step icon="bus" main={`Transbordo: Tomá el ${route.transferLine2}`} sub={`Desde ${route.transferStop!.stopName}`} action="Llegadas" />
            </button>
            <button onClick={() => onTapStop(route.toStop!.stopId)} className="w-full text-left">
              <Step icon="stop" main="Bajate en" sub={route.toStop!.stopName} action="Ver parada" />
            </button>
            <WalkingSection minutes={realWalkToMin} meters={route.walkToMeters || 0} steps={expanded ? walkFinal?.steps : undefined} fallbackLabel="hasta el destino" />
          </>
        ) : (
          <>
            <WalkingSection minutes={realWalkFromMin} meters={route.walkFromMeters} steps={expanded ? walkInitial?.steps : undefined} fallbackLabel="hasta la parada" />
            <button onClick={() => onTapStop(route.fromStop!.stopId)} className="w-full text-left">
              <Step icon="bus" main={`Tomá ${route.sharedLines[0]}${route.sharedLines.length > 1 ? ` o ${route.sharedLines.length - 1} más` : ""}`}
                sub={`Desde ${route.fromStop!.stopName}`} action="Ver llegadas" />
            </button>
            <button onClick={() => onTapStop(route.toStop!.stopId)} className="w-full text-left">
              <Step icon="stop" main="Bajate en" sub={route.toStop!.stopName} action="Ver parada" />
            </button>
            <WalkingSection minutes={realWalkToMin} meters={route.walkToMeters || 0} steps={expanded ? walkFinal?.steps : undefined} fallbackLabel="hasta el destino" />
          </>
        )}
        {!expanded && !isWalk && (
          <button
            onClick={() => setExpanded(true)}
            className="text-xs text-amber-400 font-semibold pt-1 hover:underline"
          >
            Ver caminata paso a paso ↓
          </button>
        )}
      </div>
    </motion.div>
  );
}

/**
 * Sección de caminata con pasos detallados expandibles (SRS FR-4.3).
 * Si tiene `steps` muestra cada calle. Si no, solo el resumen.
 */
function WalkingSection({
  minutes, meters, steps, fallbackLabel,
}: {
  minutes: number;
  meters: number;
  steps?: { distanceM: number; name: string; instruction: string }[];
  fallbackLabel: string;
}) {
  if (steps && steps.length > 0) {
    return (
      <div>
        <Step icon="walk" main={`Caminá ${minutes} min`} sub={`${meters}m total`} />
        <div className="mt-1.5 ml-11 space-y-1 border-l border-white/[0.06] pl-3">
          {steps.map((s, i) => (
            <div key={i} className="text-[11px] text-slate-400 leading-tight py-0.5">
              · {s.instruction}
            </div>
          ))}
        </div>
      </div>
    );
  }
  return <Step icon="walk" main={`Caminá ${minutes} min`} sub={`${meters}m ${fallbackLabel}`} />;
}

function Step({ icon, main, sub, action }: { icon: "walk" | "bus" | "stop"; main: string; sub: string; action?: string; }) {
  const iconEl = icon === "walk" ? (
    <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="1" /><path d="M9 20l3-9" /><path d="M13 13l2 4" /><path d="M7 20h3" /><path d="M16 20h-2" /><path d="M15 10l2-2-2-1" />
    </svg>
  ) : icon === "bus" ? (
    <svg className="w-4 h-4 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="14" rx="2"/><path d="M22 9H2"/><circle cx="7" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/>
    </svg>
  ) : (
    <svg className="w-4 h-4 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 00-8 8c0 6 8 12 8 12s8-6 8-12a8 8 0 00-8-8z"/>
    </svg>
  );

  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "var(--surface)" }}>
        {iconEl}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-semibold text-white truncate">{main}</p>
        <p className="text-xs text-slate-500 truncate mt-0.5">{sub}</p>
      </div>
      {action && (
        <span className="text-[10px] text-amber-400 font-semibold flex items-center gap-0.5 flex-shrink-0">
          {action}
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </span>
      )}
    </div>
  );
}

// ─── GtfsRouteCard ──────────────────────────────────────────────────
// Tarjeta para rutas planificadas con GTFS oficial (FR-4 motor real).
function GtfsRouteCard({
  route, onTapStop, onShowOnMap, destinationName,
}: {
  route: PlannedRouteDto;
  onTapStop: (id: string) => void;
  onShowOnMap?: () => void;
  destinationName?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const totalMin = Math.max(1, Math.round(route.totalSeconds / 60));
  // Ruta metropolitana (Canelones): usa al menos una variante del GTFS metro (prefijo
  // "M-"). Esas líneas son por HORARIO oficial — no tenemos GPS en vivo de las empresas
  // suburbanas. Lo decimos derecho (honestidad #1).
  const usesMetro = route.legs.some((l) => l.type === "bus" && l.variantId?.startsWith("M-"));
  const isWalkOnly = route.signature === "walk";
  // Continuación de la misma línea (183→183): el recorrido cambia, no es "otra línea".
  const contLine = route.sameLineContinuation
    ? (route.legs.find((l) => l.type === "bus")?.lines?.[0] ?? null)
    : null;

  const via = route.viaWaypoints?.length ? route.viaWaypoints : null;
  const headerLabel = isWalkOnly
    ? "Caminando"
    : via
    ? `Vía ${via.join(" · ")}`
    : contLine
    ? `Seguís en el ${contLine}`
    : route.numTransfers === 0
    ? "Directa"
    : `${route.numTransfers} transbordo${route.numTransfers > 1 ? "s" : ""}`;

  // Secuencia compacta de tramos (estilo Google Maps): 🚶 → [línea] → 🚶
  const seq: React.ReactNode[] = [];
  route.legs.forEach((leg, i) => {
    if (i > 0) seq.push(<span key={`s${i}`} style={{ color: "var(--text-3)" }}>›</span>);
    if (leg.type === "walk") {
      const m = Math.max(1, Math.round(leg.durationS / 60));
      seq.push(
        <span key={`l${i}`} style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "var(--text-2)", font: "var(--font-small)" }}>
          <Icons.Walk size={15} />{m}
        </span>
      );
    } else {
      const lns = leg.lines && leg.lines.length ? leg.lines : ["?"];
      lns.slice(0, 3).forEach((ln, k) => seq.push(<LineBadge key={`l${i}-${k}`} num={ln} size="sm" />));
      if (lns.length > 3) seq.push(<span key={`l${i}m`} style={{ color: "var(--text-3)", font: "var(--font-small)" }}>+{lns.length - 3}</span>);
    }
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="card overflow-hidden"
    >
      {/* RESUMEN compacto — tocar para ver el paso a paso */}
      <button onClick={() => setExpanded((e) => !e)} className="w-full text-left flex items-center gap-3 px-4 py-3.5">
        <div className="flex-shrink-0">
          <p style={{ font: "800 24px/1 var(--ff)", letterSpacing: "-0.02em" }}>
            {totalMin}<span style={{ font: "600 13px/1 var(--ff)", color: "var(--text-2)" }}> min</span>
          </p>
          <p className="text-eyebrow" style={{ marginTop: 4 }}>{headerLabel}</p>
          {/* Costo del boleto (tabla oficial fare.ts). Suburbano usa tarifa metropolitana
              distinta ($86+, aumentó 01/06/2026). Solo rutas con bus. */}
          {!isWalkOnly && (
            <p style={{ font: "600 11px/1 var(--ff)", color: "var(--text-3)", marginTop: 3 }}>
              🎫 {fareLabel(route.numTransfers, usesMetro)}
            </p>
          )}
        </div>
        <div className="flex-1 flex items-center gap-1.5 flex-wrap justify-end">
          {seq}
        </div>
        <span style={{ color: "var(--text-3)", transform: expanded ? "rotate(90deg)" : "none", transition: "transform 0.18s", display: "inline-flex" }}>
          <Icons.Chevron size={18} />
        </span>
      </button>

      {!expanded && (
        <div className="px-4 pb-3 -mt-1" style={{ font: "var(--font-small)", color: "var(--text-3)" }}>
          {route.alternatives && route.alternatives > 0
            ? `${route.alternatives} ${route.alternatives === 1 ? "alternativa" : "alternativas"} cercana${route.alternatives === 1 ? "" : "s"} · tocá para ver`
            : "Tocá para ver el paso a paso"}
        </div>
      )}

      {expanded && <>
      <div className="divider" />

      <div className="px-4 py-5">
        {usesMetro && (
          <div className="metro-note" style={{ marginBottom: 16 }}>
            <Icons.Bus size={15} />
            <span>Viaje <b>metropolitano</b> (Canelones). Estos horarios son los <b>oficiales programados</b> del MTOP — todavía no tenemos GPS en vivo de las empresas suburbanas, así que mostramos el horario, no la posición real.</span>
          </div>
        )}
        {contLine && (
          <div className="cont-note" style={{ marginBottom: 16 }}>
            <Icons.Warn size={15} />
            <span>El <b>{contLine}</b> cambia de recorrido en el camino. Seguís en un <b>{contLine}</b> desde la misma parada — puede ser el mismo coche o el próximo de la línea. Te lo decimos derecho, sin inventar.</span>
          </div>
        )}

        {/* Timeline vertical: queda CLARO que caminás a la parada, ahí esperás y
            tomás el bondi, te bajás, y caminás al destino. */}
        <ol className="trip-timeline">
          {/* Nodo ORIGEN */}
          <li className="tl-node">
            <span className="tl-dot tl-dot-origin" />
            <div className="tl-body">
              <p className="tl-main">Tu ubicación</p>
              <p className="tl-sub">Empezás acá</p>
            </div>
          </li>

          {route.legs.map((leg, i) => {
            const minutes = Math.max(1, Math.round(leg.durationS / 60));
            const isLast = i === route.legs.length - 1;
            if (leg.type === "walk") {
              return (
                <li className="tl-node" key={i}>
                  <span className="tl-line tl-line-walk" />
                  <span className="tl-icon"><Icons.Walk size={15} /></span>
                  <div className="tl-body">
                    <p className="tl-main">Caminá {minutes} min{isWalkOnly ? " hasta el destino" : ""}</p>
                    <p className="tl-sub">
                      {leg.distanceM}m{!isWalkOnly && leg.toStopName ? <> · llegás a <b>{leg.toStopName}</b></> : isWalkOnly ? "" : ""}
                    </p>
                  </div>
                </li>
              );
            }
            // BUS: nodo de PARADA con badge de la línea — "acá te tomás el bondi".
            return (
              <BusTimelineLeg
                key={i}
                leg={leg}
                minutes={minutes}
                onTapStop={onTapStop}
              />
            );
          })}

          {/* Nodo DESTINO */}
          {!isWalkOnly && (
            <li className="tl-node">
              <span className="tl-line tl-line-walk" />
              <span className="tl-dot tl-dot-dest" />
              <div className="tl-body">
                <p className="tl-main">{destinationName || "Destino"}</p>
                <p className="tl-sub">Llegaste 🎉</p>
              </div>
            </li>
          )}
        </ol>

        {/* Impacto del viaje (CO₂ + calorías) — OPT-IN y discreto. Va dentro de un
            desplegable cerrado por defecto: no es el foco (el foco es "qué bus tomo").
            Decisión de producto: NO mostrarlo siempre para no sentirse moralista ni
            "relleno"; el uruguayo quiere saber qué bondi tomar, no un sermón verde.
            Solo aparece si el usuario TOCA "Ver impacto del viaje". */}
        {!isWalkOnly && (() => {
          const busM = route.legs.filter((l) => l.type === "bus").reduce((s, l) => s + (l.distanceM || 0), 0);
          const walkMin = Math.round(route.legs.filter((l) => l.type === "walk").reduce((s, l) => s + l.durationS, 0) / 60);
          const label = tripImpactLabel(busM, walkMin);
          return label ? (
            <details className="trip-impact-details">
              <summary>Ver impacto del viaje</summary>
              <div className="trip-impact-body">{label}</div>
            </details>
          ) : null;
        })()}

        {/* Viaje mixto: taxi/Uber para el último tramo (de noche o si la caminata es larga) */}
        <MixedTripOption route={route} destinationName={destinationName} />

        {/* Acciones: ver en el mapa + compartir — solo para rutas con bus. */}
        {!isWalkOnly && (
          <div className="mt-2 flex gap-2">
            {onShowOnMap && (
              <button
                onClick={onShowOnMap}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-2)" }}
              >
                <Icons.Map size={16} />
                Ver en el mapa
              </button>
            )}
            {/* Compartir el viaje (Web Share API → portapapeles). "Te aviso por dónde voy". */}
            <button
              onClick={async () => {
                const r = await shareTrip(route, destinationName);
                if (r === "copied") { setShareMsg("Copiado ✓"); setTimeout(() => setShareMsg(null), 1800); }
                else if (r === "error") { setShareMsg("No se pudo compartir"); setTimeout(() => setShareMsg(null), 1800); }
              }}
              aria-label="Compartir viaje"
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-2)", minWidth: shareMsg ? undefined : 48 }}
            >
              {shareMsg ? (
                <span style={{ font: "600 12px/1 var(--ff)" }}>{shareMsg}</span>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
              )}
            </button>
          </div>
        )}
      </div>
      </>}
    </motion.div>
  );
}

// ── BusTimelineLeg ─────────────────────────────────────────────────
// Nodo de bus en el timeline: deja CLARO que te subís a la línea en una parada
// concreta, esperás el próximo, y te bajás N paradas después. La parada es el nodo.
function BusTimelineLeg({
  leg, minutes, onTapStop,
}: {
  leg: RouteLegDto;
  minutes: number;
  onTapStop: (id: string) => void;
}) {
  const lines = leg.lines && leg.lines.length ? leg.lines : ["?"];
  const lineList = lines.length > 1
    ? `${lines.slice(0, -1).join(", ")} o ${lines[lines.length - 1]}`
    : lines[0];
  const dest = (leg.headsign || "").split(" ").slice(0, 4).join(" ");
  const { etaMin, realtime, loading } = useNextArrivalForLine(leg.fromStopId, lines[0]);

  let nextLabel = "", nextClass = "";
  if (loading) { nextLabel = "Buscando próximo…"; nextClass = "tl-next-muted"; }
  else if (etaMin !== null) {
    nextLabel = `${realtime ? "● en vivo" : "○ horario"} · próximo en ${etaMin === 0 ? "<1" : etaMin} min`;
    nextClass = etaMin <= 3 ? "tl-next-soon" : "tl-next";
  }

  return (
    <li className="tl-node tl-node-bus">
      <span className="tl-line tl-line-bus" />
      {/* El nodo es la PARADA donde te subís (círculo con el badge de la línea). */}
      <button
        className="tl-stop-dot"
        onClick={() => leg.fromStopId && onTapStop(leg.fromStopId)}
        aria-label="Ver llegadas de esta parada"
      >
        <LineBadge num={lines[0]} size="sm" />
      </button>
      <div className="tl-body">
        <button className="tl-bus-head" onClick={() => leg.fromStopId && onTapStop(leg.fromStopId)}>
          <p className="tl-main">
            Tomá el <b>{lineList}</b>{dest && <> hacia {dest}</>}
          </p>
          <span className="tl-llegadas">Llegadas <Icons.Chevron size={12} /></span>
        </button>
        <p className="tl-sub">
          En <b>{leg.fromStopName || "la parada"}</b> · {leg.numStops ?? "?"} paradas · {minutes} min
        </p>
        {nextLabel && <p className={`tl-nextline ${nextClass}`}>{nextLabel}</p>}
        {leg.closingSoon && typeof leg.endOfServiceMin === "number" && (
          <p className="tl-closing">
            <Icons.Clock size={12} /> Última corrida ~{String(Math.floor(leg.endOfServiceMin / 60) % 24).padStart(2, "0")}:{String(leg.endOfServiceMin % 60).padStart(2, "0")}
          </p>
        )}
      </div>
    </li>
  );
}


// ── Clasificación de área (FR-4.6) ─────────────────────────────────
// Bbox COBERTURA: MVD + Canelones cercano (Cdad de la Costa, Las Piedras,
// La Paz, Pando, Atlántida hasta Salinas). STM no cubre fuera de esto.
const COVERAGE_BBOX = { north: -34.5, south: -35.0, west: -56.5, east: -55.5 };

function inBbox(p: { lat: number; lon: number }, b: typeof COVERAGE_BBOX): boolean {
  return p.lat <= b.north && p.lat >= b.south && p.lon >= b.west && p.lon <= b.east;
}

type AreaCheck =
  | { kind: "ok" }
  | { kind: "out-of-coverage"; which: "from" | "to" | "both" }
  | { kind: "interdepartmental"; which: "from" | "to" | "both" };

function classifyArea(from: Place | null, to: Place | null): AreaCheck {
  const fromState = !from ? "ok" : inBbox(from, COVERAGE_BBOX) ? "ok" : "out";
  const toState = !to ? "ok" : inBbox(to, COVERAGE_BBOX) ? "ok" : "out";
  if (fromState === "ok" && toState === "ok") return { kind: "ok" };
  // Si ambos están fuera y muy lejos: interdepartamental
  const fromVeryFar = from && !inBbox(from, COVERAGE_BBOX) && distFromMvd(from) > 80;
  const toVeryFar = to && !inBbox(to, COVERAGE_BBOX) && distFromMvd(to) > 80;
  if (fromVeryFar || toVeryFar) {
    const which: "from" | "to" | "both" =
      fromVeryFar && toVeryFar ? "both" : fromVeryFar ? "from" : "to";
    return { kind: "interdepartmental", which };
  }
  const which: "from" | "to" | "both" =
    fromState === "out" && toState === "out" ? "both" :
    fromState === "out" ? "from" : "to";
  return { kind: "out-of-coverage", which };
}

function distFromMvd(p: { lat: number; lon: number }): number {
  // Distancia aproximada en km a Plaza Independencia
  const R = 6371;
  const lat0 = -34.9058, lon0 = -56.1913;
  const dLat = ((p.lat - lat0) * Math.PI) / 180;
  const dLon = ((p.lon - lon0) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat0 * Math.PI) / 180) * Math.cos((p.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── OutOfAreaState (FR-4.6) ───────────────────────────────────────
interface InterdeptSalida { empresa: string; salida: string; llegada: string; dias: string }
interface InterdeptResp { found: boolean; ciudad?: string; depto?: string; totalDiarias?: number; empresas?: string[]; terminal?: string; salidas: InterdeptSalida[]; fuente?: string }

function OutOfAreaState({ info, destName, onPlanToTerminal }: { info: AreaCheck; destName?: string; onPlanToTerminal?: () => void }) {
  const isInterdept = info.kind === "interdepartmental";
  // Para viajes interdepartamentales, traemos las próximas salidas oficiales del MTOP.
  const [inter, setInter] = useState<InterdeptResp | null>(null);
  useEffect(() => {
    if (!isInterdept || !destName) { setInter(null); return; }
    let cancelled = false;
    fetch(`/api/interdept?dest=${encodeURIComponent(destName)}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setInter(d); })
      .catch(() => { if (!cancelled) setInter(null); });
    return () => { cancelled = true; };
  }, [isInterdept, destName]);

  if (info.kind === "ok") return null;

  const whichLabel = info.which === "from" ? "El origen" :
                     info.which === "to" ? "El destino" : "Origen y destino";

  const title = isInterdept ? "Viaje interdepartamental" : "Fuera del área de cobertura";

  return (
    <div className="flex flex-col items-center text-center py-10 px-6">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
           style={{ background: isInterdept ? "rgba(168,85,247,0.15)" : "rgba(251,191,36,0.15)" }}>
        {isInterdept ? (
          <svg className="w-7 h-7 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><circle cx="9" cy="15" r="1.5"/><circle cx="15" cy="15" r="1.5"/>
          </svg>
        ) : (
          <svg className="w-7 h-7 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        )}
      </div>
      <h3 className="text-headline mb-1.5">{title}</h3>

      {/* Salidas interdepartamentales reales (horario oficial MTOP). */}
      {isInterdept && inter?.found && inter.salidas.length > 0 ? (
        <div className="w-full max-w-sm mt-1">
          {/* A dónde ir y por qué */}
          {inter.terminal && (
            <div className="interdept-where">
              <Icons.Pin size={15} />
              <span>Estos servicios salen de la <b>{inter.terminal}</b>. Es de larga distancia: comprás el pasaje ahí o por la empresa.</span>
            </div>
          )}
          {inter.empresas && inter.empresas.length > 0 && (
            <p className="text-[12px] text-slate-500 mb-2">
              {inter.empresas.length === 1 ? "Compañía: " : `${inter.empresas.length} compañías: `}
              <span className="text-slate-300">{inter.empresas.join(" · ")}</span>
            </p>
          )}
          <p className="text-body text-slate-500 mb-3">
            Próximas salidas desde Montevideo hacia <b className="text-slate-300">{inter.ciudad}</b>:
          </p>
          <div className="interdept-list">
            {inter.salidas.map((s, i) => (
              <div key={i} className="interdept-row">
                <span className="id-time tnum">{s.salida}</span>
                <div className="id-body">
                  <span className="id-emp">{s.empresa}</span>
                  <span className="id-sub">llega {s.llegada || "—"}</span>
                </div>
                <span className="id-tag">horario</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-600 mt-2.5">
            {inter.totalDiarias} salidas hoy · datos oficiales MTOP (programados)
          </p>
          <div className="flex flex-col gap-2 mt-3">
            {/* Cómo llegar a la terminal en bus desde donde estás. */}
            {onPlanToTerminal && (
              <button
                onClick={onPlanToTerminal}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: "var(--accent)", color: "#1a1206" }}
              >
                <Icons.Bus size={16} /> Cómo llegar a la Terminal Tres Cruces
              </button>
            )}
            <a
              href="https://www.trescruces.com.uy/horarios" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-purple-300"
              style={{ background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.25)" }}
            >
              Comprar pasaje / más horarios
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>
              </svg>
            </a>
          </div>
        </div>
      ) : (
        <>
          <p className="text-body text-slate-500 leading-relaxed max-w-sm">
            {isInterdept ? (
              <>{whichLabel} {info.which === "both" ? "están" : "está"} a más de 80km de Montevideo. Es un viaje interdepartamental — salís desde el Terminal Tres Cruces.</>
            ) : (
              <>{whichLabel} {info.which === "both" ? "están" : "está"} fuera del área de cobertura (Montevideo + Canelones metropolitano). Probá moviendo el pin más cerca de la ciudad.</>
            )}
          </p>
          {isInterdept && (
            <a
              href="https://www.trescruces.com.uy/horarios" target="_blank" rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-purple-300"
              style={{ background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.25)" }}
            >
              Ver horarios Terminal Tres Cruces
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>
              </svg>
            </a>
          )}
        </>
      )}
    </div>
  );
}

// ── DepartTimePicker ───────────────────────────────────────────────
// "Salir ahora" / "Salir a las HH:MM". Cuando hay hora, construye un ISO para hoy;
// si la hora ya pasó hoy, asume mañana (planificás el primer viaje de mañana).
function DepartTimePicker({ value, onChange, children }: { value: string | null; onChange: (iso: string | null) => void; children?: React.ReactNode }) {
  const [editing, setEditing] = useState(false);

  // value (ISO) → "HH:MM" para mostrar y para el <input type=time>.
  const hhmm = value ? new Date(value).toTimeString().slice(0, 5) : "";

  const setFromHHMM = (t: string) => {
    if (!t) { onChange(null); return; }
    const [h, m] = t.split(":").map(Number);
    const d = new Date();
    d.setSeconds(0, 0);
    d.setHours(h, m, 0, 0);
    // Si la hora elegida ya pasó hoy, planificamos para mañana.
    if (d.getTime() < Date.now() - 60_000) d.setDate(d.getDate() + 1);
    onChange(d.toISOString());
  };

  return (
    <div className="depart-row">
      <button
        className={`depart-chip ${!value ? "on" : ""}`}
        onClick={() => { onChange(null); setEditing(false); }}
        aria-pressed={!value}
      >
        <Icons.Clock size={14} /> Salir ahora
      </button>

      {value && !editing ? (
        <button className="depart-chip on" onClick={() => setEditing(true)} aria-label="Cambiar hora de salida">
          Salida {hhmm}
          {new Date(value).getDate() !== new Date().getDate() && <span className="depart-day"> mañana</span>}
        </button>
      ) : (
        <label className={`depart-chip ${value ? "on" : ""}`}>
          {!value && <span style={{ opacity: 0.85 }}>Más tarde</span>}
          <input
            type="time"
            value={hhmm}
            onChange={(e) => { setFromHHMM(e.target.value); setEditing(false); }}
            className="depart-time-input"
            aria-label="Hora de salida"
          />
        </label>
      )}
      {children}
    </div>
  );
}

// ── ServiceAlertsNote ─────────────────────────────────────────────────
// Línea DISCRETA al final de las rutas: acceso a desvíos oficiales de la IM.
// La IM no da API de alertas (verificado) → linkeamos su fuente oficial, sin
// scraping frágil. No invasivo: solo un recordatorio honesto de "fijate si hay corte".
function ServiceAlertsNote() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 14 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ display: "flex", alignItems: "center", gap: 7, font: "500 12px/1.3 var(--ff)", color: "var(--text-3)", padding: "6px 2px" }}
      >
        <Icons.Warn size={14} />
        ¿Hay obras o desvíos? Fijate en la fuente oficial
        <span style={{ fontSize: 10, transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }}>▾</span>
      </button>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
          {SERVICE_ALERT_SOURCES.map((s) => (
            <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer"
              style={{ display: "flex", flexDirection: "column", padding: "9px 12px", borderRadius: "var(--r-card)", background: "var(--surface)", border: "1px solid var(--border)" }}>
              <span style={{ font: "600 13px/1.2 var(--ff)", color: "var(--text)" }}>{s.label} ↗</span>
              <span style={{ font: "500 11px/1.3 var(--ff)", color: "var(--text-3)", marginTop: 2 }}>{s.sublabel}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
