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
import { useRoutePlanner, type PlannedRouteDto } from "@/hooks/useRouteplanner";
import { setSelectedRoute } from "@/lib/selected-route";
import { setActiveTab } from "@/lib/active-tab";
import { useRouteInput, setRouteInput } from "@/lib/route-input";
import { useNextArrivalForLine } from "@/hooks/useNextArrivalForLine";
import { useVoiceInput } from "@/hooks/useVoiceInput";

interface Place { name: string; subtitle?: string; lat: number; lon: number; icon?: string; }

const HISTORY_KEY = "ondas_route_history";
const MAX_HISTORY = 6;

export default function RouteScreen() {
  const { location } = useLocation();
  const { ready: stopsReady } = useStopsDataset();
  const selectedPlace = useSelectedPlace();
  const [from, setFrom] = useState<Place | null>(null);
  const [to, setTo] = useState<Place | null>(null);
  const [activeInput, setActiveInput] = useState<"from" | "to" | null>(null);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [sheetStopId, setSheetStopId] = useState<string | null>(null);
  const [history, setHistory] = useState<Place[]>([]);
  const [voiceError, setVoiceError] = useState<string | null>(null);
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

  // FR-4.1: si el usuario llegó acá desde long-press en el mapa, pre-cargar el slot
  const routeInput = useRouteInput();
  useEffect(() => {
    if (!routeInput) return;
    const place = { name: routeInput.point.name || "Punto en el mapa", lat: routeInput.point.lat, lon: routeInput.point.lon };
    if (routeInput.slot === "from") setFrom(place);
    else setTo(place);
    setRouteInput(null);
  }, [routeInput]);

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
    saveToHistory(place);
    setActiveInput(null);
    setQuery("");
    setSuggestions([]);
  }

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

  // Heurística legacy como fallback rápido si el endpoint GTFS falla
  const heuristicRoutes = useMemo<RouteCandidate[]>(() => {
    if (!from || !to || !stopsReady || outOfArea) return [];
    return planRoutes(STOPS_DATASET, from, to, { walkRadiusM: 1500, maxCandidates: 6 });
  }, [from, to, stopsReady, outOfArea]);

  // Router GTFS (server) — fuente principal
  const { routes: gtfsRoutes, loading: gtfsLoading } = useRoutePlanner(from, to, !!from && !!to && !outOfArea);

  // Usar GTFS si dio resultados, sino fallback heurístico
  const usingGtfs = gtfsRoutes.length > 0;
  const routes = usingGtfs ? [] : heuristicRoutes; // legacy renderiza solo si no hay GTFS

  const showSuggestions = activeInput !== null;

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <header className="px-4 pt-[max(env(safe-area-inset-top),14px)] pb-3 flex-shrink-0">
        <h1 className="text-title-large mt-2 mb-4">Cómo llegar</h1>

        {/* Inputs origen / destino */}
        <div className="card p-3 space-y-2">
          <PlaceInput
            label="Desde"
            place={from}
            active={activeInput === "from"}
            dotColor="#10b981"
            onFocus={() => { setActiveInput("from"); setQuery(""); }}
            onClear={() => setFrom(null)}
          />
          <div className="flex items-center gap-2">
            <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
            <button onClick={swap} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "var(--surface)" }}>
              <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M7 10l5-5 5 5"/><path d="M7 14l5 5 5-5"/>
              </svg>
            </button>
            <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
          </div>
          <PlaceInput
            label="Hacia"
            place={to}
            active={activeInput === "to"}
            dotColor="#ef4444"
            onFocus={() => { setActiveInput("to"); setQuery(""); }}
            onClear={() => setTo(null)}
          />
        </div>
      </header>

      {/* Suggestions o resultados */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
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
                {voice.supported && (
                  <button
                    onClick={() => voice.state === "listening" ? voice.stop() : voice.start()}
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
                <button onClick={() => { setActiveInput(null); setQuery(""); voice.stop(); }} className="text-xs text-blue-400 font-semibold flex-shrink-0">Cancelar</button>
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
                    <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
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
                <div>
                  <p className="text-eyebrow mb-2">Recientes</p>
                  <div className="space-y-1.5">
                    {history.map((h, i) => (
                      <button
                        key={i}
                        onClick={() => pickPlace(h)}
                        className="w-full card-soft px-3 py-2.5 flex items-center gap-3 text-left"
                      >
                        <svg className="w-4 h-4 text-slate-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                        </svg>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-white truncate">{h.name}</p>
                          {h.subtitle && <p className="text-[11px] text-slate-500 truncate">{h.subtitle}</p>}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Resultados de búsqueda */}
              {searching && (
                <p className="text-xs text-slate-500 text-center py-3">Buscando…</p>
              )}
              {!searching && query && suggestions.length === 0 && (
                <p className="text-xs text-slate-500 text-center py-6">Sin resultados</p>
              )}
              {suggestions.length > 0 && (
                <div className="space-y-1.5">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => pickPlace(s)}
                      className="w-full card-soft px-3 py-2.5 flex items-center gap-3 text-left"
                    >
                      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm" style={{ background: "var(--surface)" }}>
                        {s.icon ? (
                          <span>{s.icon}</span>
                        ) : (
                          <svg className="w-3.5 h-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            {s.subtitle?.startsWith("Parada") ? (
                              <><rect x="2" y="4" width="20" height="14" rx="2"/><path d="M22 9H2"/></>
                            ) : (
                              <><circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 00-8 8c0 6 8 12 8 12s8-6 8-12a8 8 0 00-8-8z"/></>
                            )}
                          </svg>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white truncate">{s.name}</p>
                        {s.subtitle && <p className="text-[11px] text-slate-500 truncate">{s.subtitle}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
              {!from || !to ? (
                <EmptyState />
              ) : outOfArea ? (
                <OutOfAreaState info={areaCheck} />
              ) : !stopsReady ? (
                <p className="text-center text-slate-500 text-sm py-12">Cargando paradas…</p>
              ) : gtfsLoading ? (
                <p className="text-center text-slate-500 text-sm py-12">Buscando rutas…</p>
              ) : usingGtfs ? (
                <>
                  <p className="text-eyebrow mt-1">
                    {gtfsRoutes.length} {gtfsRoutes.length === 1 ? "opción" : "opciones"} · datos oficiales STM
                  </p>
                  {gtfsRoutes.map((r, i) => (
                    <GtfsRouteCard
                      key={r.signature || i}
                      route={r}
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
    </div>
  );
}

function PlaceInput({
  label, place, active, dotColor, onFocus, onClear,
}: { label: string; place: Place | null; active: boolean; dotColor: string; onFocus: () => void; onClear: () => void; }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onFocus}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onFocus(); }}
      className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl"
      style={{
        background: active ? "var(--accent-soft)" : "transparent",
      }}
    >
      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: dotColor }} />
      <div className="flex-1 min-w-0 text-left">
        <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">{label}</p>
        {place ? (
          <p className="text-sm font-semibold text-white truncate">{place.name}</p>
        ) : (
          <p className="text-sm text-slate-500">Tocá para elegir</p>
        )}
      </div>
      {place && (
        <button
          onClick={(e) => { e.stopPropagation(); onClear(); }}
          className="w-6 h-6 rounded-full flex items-center justify-center"
          style={{ background: "var(--surface)" }}
        >
          <svg className="w-3 h-3 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center text-center py-16 px-6">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: "var(--accent-soft)" }}>
        <svg className="w-8 h-8 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
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
                     style={{ background: "var(--accent)" }}>{l}</span>
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
                     style={{ background: "var(--accent)" }}>{l}</span>
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
                  style={{ background: "var(--accent)", letterSpacing: "-0.02em" }}>
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
              <span className="text-[11px] font-black px-2 py-1 rounded-md text-white" style={{ background: "var(--accent)" }}>{route.transferLine1}</span>
              <svg className="w-3 h-3 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><polyline points="9 18 15 12 9 6" /></svg>
              <span className="text-[11px] font-black px-2 py-1 rounded-md text-white" style={{ background: "var(--accent)" }}>{route.transferLine2}</span>
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
            className="text-xs text-blue-400 font-semibold pt-1 hover:underline"
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
    <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
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
        <p className="text-sm font-semibold text-white truncate">{main}</p>
        <p className="text-[11px] text-slate-500 truncate">{sub}</p>
      </div>
      {action && (
        <span className="text-[10px] text-blue-400 font-semibold flex items-center gap-0.5 flex-shrink-0">
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
  route, onTapStop, onShowOnMap,
}: {
  route: PlannedRouteDto;
  onTapStop: (id: string) => void;
  onShowOnMap?: () => void;
}) {
  const totalMin = Math.max(1, Math.round(route.totalSeconds / 60));
  const isWalkOnly = route.signature === "walk";
  const busLegs = route.legs.filter((l) => l.type === "bus");
  const lineBadges = busLegs.flatMap((l) => l.lines || []);

  const headerLabel = isWalkOnly
    ? "Caminando"
    : route.numTransfers === 0
    ? "Directa"
    : `${route.numTransfers} transbordo${route.numTransfers > 1 ? "s" : ""}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="card overflow-hidden"
    >
      <div className="px-4 pt-3.5 pb-3 flex items-center justify-between">
        <div>
          <p className="text-eyebrow mb-0.5">{headerLabel}</p>
          <p className="text-headline">{totalMin} min</p>
          {!!route.alternatives && route.alternatives > 0 && (
            <p className="text-[10px] text-slate-500 mt-0.5">
              {route.alternatives === 1
                ? "1 parada alternativa cercana"
                : `${route.alternatives} alternativas cercanas`}
            </p>
          )}
        </div>
        {isWalkOnly ? (
          <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "rgba(16,185,129,0.15)" }}>
            <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="5" r="1"/><path d="M9 20l3-9"/><path d="M13 13l2 4"/><path d="M7 20h3"/>
            </svg>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 justify-end max-w-[60%] flex-wrap">
            {lineBadges.map((l, i) => (
              <span key={i} className="text-[11px] font-black px-2 py-1 rounded-md text-white"
                style={{ background: "var(--accent)" }}>{l}</span>
            ))}
          </div>
        )}
      </div>

      <div className="divider" />

      <div className="px-4 py-3 space-y-2.5">
        {route.legs.map((leg, i) => {
          if (leg.type === "walk") {
            const minutes = Math.max(1, Math.round(leg.durationS / 60));
            const isLast = i === route.legs.length - 1;
            const target = leg.toStopName || (isLast ? "el destino" : "la parada");
            return (
              <Step
                key={i}
                icon="walk"
                main={isWalkOnly ? `Caminá ${minutes} min hasta el destino` : `Caminá ${minutes} min`}
                sub={`${leg.distanceM}m${isWalkOnly ? "" : ` hasta ${target}`}`}
              />
            );
          }
          // bus
          const minutes = Math.max(1, Math.round(leg.durationS / 60));
          const line = leg.lines?.[0] || "?";
          return (
            <GtfsBusLegStep
              key={i}
              line={line}
              headsign={leg.headsign || ""}
              fromStopId={leg.fromStopId}
              fromStopName={leg.fromStopName}
              numStops={leg.numStops}
              minutes={minutes}
              closingSoon={leg.closingSoon}
              endOfServiceMin={leg.endOfServiceMin}
              onTap={() => leg.fromStopId && onTapStop(leg.fromStopId)}
            />
          );
        })}

        {/* Botón "Ver en el mapa" — solo para rutas con bus (caminar ya es trivial) */}
        {onShowOnMap && !isWalkOnly && (
          <button
            onClick={onShowOnMap}
            className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-blue-300"
            style={{ background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.25)" }}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <polygon points="3 11 22 2 13 21 11 13 3 11"/>
            </svg>
            Ver en el mapa
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ── GtfsBusLegStep ─────────────────────────────────────────────────
// Paso de bus con ETA en vivo (FR-4.4) integrado en el Cómo Llegar.
function GtfsBusLegStep({
  line, headsign, fromStopId, fromStopName, numStops, minutes,
  closingSoon, endOfServiceMin, onTap,
}: {
  line: string;
  headsign: string;
  fromStopId?: string;
  fromStopName?: string;
  numStops?: number;
  minutes: number;
  closingSoon?: boolean;
  endOfServiceMin?: number;
  onTap: () => void;
}) {
  const { etaMin, realtime, loading } = useNextArrivalForLine(fromStopId, line);

  // Mensaje del próximo bus
  let nextLabel = "";
  let nextColor = "";
  if (loading) {
    nextLabel = "Buscando próximo…";
    nextColor = "text-slate-600";
  } else if (etaMin !== null) {
    const prefix = realtime ? "● Próximo" : "○ Próximo (horario)";
    nextLabel = `${prefix} en ${etaMin === 0 ? "<1" : etaMin} min`;
    nextColor = etaMin <= 3
      ? "text-emerald-400"
      : etaMin <= 10
      ? "text-amber-400"
      : "text-blue-400";
  }

  return (
    <button onClick={onTap} className="w-full text-left">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
             style={{ background: "var(--surface)" }}>
          <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="14" rx="2"/><path d="M22 9H2"/>
            <circle cx="7" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/>
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">
            Tomá el {line} hacia {headsign.split(" ").slice(0, 4).join(" ")}
          </p>
          <p className="text-[11px] text-slate-500 truncate">
            Desde {fromStopName} · {numStops} paradas · {minutes} min
          </p>
          {nextLabel && (
            <p className={`text-[11px] font-bold mt-0.5 ${nextColor}`}>{nextLabel}</p>
          )}
          {closingSoon && typeof endOfServiceMin === "number" && (
            <p className="text-[11px] font-bold mt-0.5 text-amber-400 flex items-center gap-1">
              <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              Última corrida ~{String(Math.floor(endOfServiceMin / 60) % 24).padStart(2, "0")}:{String(endOfServiceMin % 60).padStart(2, "0")}
            </p>
          )}
        </div>
        <span className="text-[10px] text-blue-400 font-semibold flex items-center gap-0.5 flex-shrink-0">
          Llegadas
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </span>
      </div>
    </button>
  );
}

// ── Clasificación de área (FR-4.6) ─────────────────────────────────
// Bbox COBERTURA: MVD + Canelones cercano (Cdad de la Costa, Las Piedras,
// La Paz, Pando, Atlántida hasta Salinas). STM no cubre fuera de esto.
const COVERAGE_BBOX = { north: -34.5, south: -35.0, west: -56.5, east: -55.5 };
// Bbox MVD estricto: lo que está dentro es "ok"; entre MVD y borde es "perimetral".
const MVD_BBOX = { north: -34.7, south: -34.95, west: -56.4, east: -56.0 };

function inBbox(p: { lat: number; lon: number }, b: typeof MVD_BBOX): boolean {
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
function OutOfAreaState({ info }: { info: AreaCheck }) {
  if (info.kind === "ok") return null;

  const whichLabel = info.which === "from" ? "El origen" :
                     info.which === "to" ? "El destino" : "Origen y destino";

  const isInterdept = info.kind === "interdepartmental";
  const title = isInterdept ? "Viaje interdepartamental" : "Fuera del área de cobertura";
  const body = isInterdept ? (
    <>
      {whichLabel} {info.which === "both" ? "están" : "está"} a más de 80km de Montevideo.
      Para viajes interdepartamentales usá COT, Copsa, Núñez u otra empresa del
      <span className="text-slate-400"> Terminal Tres Cruces</span>.
    </>
  ) : (
    <>
      {whichLabel} {info.which === "both" ? "están" : "está"} fuera del área de cobertura de STM
      (Montevideo + Ciudad de la Costa, Las Piedras, La Paz, Pando, Atlántida).
      Probá moviendo el pin más cerca de la ciudad.
    </>
  );

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
      <p className="text-body text-slate-500 leading-relaxed max-w-sm">{body}</p>
      {isInterdept && (
        <a
          href="https://www.trescruces.com.uy/horarios"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-purple-300"
          style={{ background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.25)" }}
        >
          Ver horarios Terminal Tres Cruces
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>
          </svg>
        </a>
      )}
    </div>
  );
}
