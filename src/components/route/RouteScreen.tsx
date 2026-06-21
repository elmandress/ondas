"use client";

/**
 * Pestaña Cómo Ir — ORQUESTADOR. Mantiene el estado del planificador
 * (origen/destino/waypoints, input activo + búsqueda compartida, hora de
 * salida, optimización) y la coordinación entre motores (GTFS server →
 * heurístico fallback). La UI vive en componentes hermanos:
 * RouteInputs, PlaceSearch, GtfsRouteCard, HeuristicRouteCard, RouteStates.
 *
 * Claves del estado compartido (no mover a los hijos):
 *  - `activeInput` puede ser "from" | "to" | `wp-${i}` — un solo buscador
 *    sirve para todos los slots.
 *  - El historial se guarda en localStorage (HISTORY_KEY).
 *  - `useRoutePlanner` llama a /api/route/plan (motor real); `planRoutes`
 *    es la heurística legacy SOLO como fallback.
 */
import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "@/hooks/useLocation";
import { useStopsDataset } from "@/hooks/useStopsDataset";
import { STOPS_DATASET } from "@/lib/stm";
import { planRoutes, type RouteCandidate } from "@/lib/route-planner";
import StopArrivalSheet from "@/components/home/StopArrivalSheet";
import { useSelectedPlace, setSelectedPlace } from "@/lib/selected-place";
import { useRoutePlanner, type PlannedRouteDto } from "@/hooks/useRouteplanner";
import { setSelectedRoute } from "@/lib/selected-route";
import { setActiveTab } from "@/lib/active-tab";
import { track } from "@/lib/analytics";
import { saferAlternative } from "@/lib/trip-safety";
import { useRouteInput, setRouteInput } from "@/lib/route-input";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { classifyArea } from "@/lib/route-area";
import { LogoLockup } from "@/components/brand/Logo";
import { Icons } from "@/components/brand/Icons";
import VoiceOverlay from "@/components/ui/VoiceOverlay";
import { useMounted } from "@/hooks/useMounted";
import { usePlaceSearch } from "@/hooks/usePlaceSearch";
import type { Place } from "@/components/route/types";
import { PlaceInput, DepartTimePicker } from "@/components/route/RouteInputs";
import PlaceSearch from "@/components/route/PlaceSearch";
import GtfsRouteCard from "@/components/route/GtfsRouteCard";
import HeuristicRouteCard from "@/components/route/HeuristicRouteCard";
import { PlannerEmptyState, NoRoutesState, OutOfAreaState } from "@/components/route/RouteStates";
import ServiceAlertsNote from "@/components/route/ServiceAlertsNote";

const HISTORY_KEY = "ondas_route_history";
const MAX_HISTORY = 6;

export default function RouteScreen() {
  const { location, isReal: locationIsReal, status: locationStatus, retry: retryLocation } = useLocation();
  const { ready: stopsReady } = useStopsDataset();
  const selectedPlace = useSelectedPlace();
  const [from, setFrom] = useState<Place | null>(null);
  const [to, setTo] = useState<Place | null>(null);
  // Paradas intermedias (hasta 3). El input activo de un waypoint se identifica como `wp-${i}`.
  const [waypoints, setWaypoints] = useState<Place[]>([]);
  const [activeInput, setActiveInput] = useState<"from" | "to" | `wp-${number}` | null>(null);
  const [query, setQuery] = useState("");

  // R68: geocode de lugares vía el hook compartido (mismo fetch+debounce+abort que Buscar
  // y Guardar ruta). Busca SOLO el input activo — origen/destino se editan de a uno, nunca
  // hay dos búsquedas en simultáneo. Las paradas locales (instantáneas) se combinan acá.
  const { results: placeHits, loading: searching } = usePlaceSearch(activeInput ? query : "", { debounceMs: 250 });
  const stopMatches = useMemo<Place[]>(() => {
    if (!activeInput || !query.trim() || !stopsReady) return [];
    const q = query.trim().toLowerCase();
    return STOPS_DATASET
      .filter((s) => s.stopName.toLowerCase().includes(q) || s.stopCode.includes(q))
      .slice(0, 5)
      .map((s) => ({ name: s.stopName, subtitle: `Parada #${s.stopCode}`, lat: s.stopLat, lon: s.stopLon }));
  }, [query, activeInput, stopsReady]);
  const suggestions = useMemo<Place[]>(
    () => [
      ...stopMatches,
      ...placeHits.slice(0, 5).map((r) => ({
        name: r.name,
        subtitle: r.fullName ? r.fullName.split(",").slice(1, 3).join(",").trim() : undefined,
        lat: r.lat,
        lon: r.lon,
        icon: r.icon,
      })),
    ],
    [stopMatches, placeHits],
  );
  const [sheetStopId, setSheetStopId] = useState<string | null>(null);
  const [history, setHistory] = useState<Place[]>([]);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const mounted = useMounted();

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
    if (location && locationIsReal && !from) {
      setFrom({ name: "Mi ubicación", subtitle: "Posición actual", lat: location.lat, lon: location.lon });
    }
  }, [location, locationIsReal, from]);

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
      if (routeInput.fromCurrentLocation && location && locationIsReal) {
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
  }, [routeInput, location, locationIsReal]);

  function pickPlace(place: Place) {
    if (activeInput === "from") setFrom(place);
    else if (activeInput === "to") setTo(place);
    else if (typeof activeInput === "string" && activeInput.startsWith("wp-")) {
      const i = Number(activeInput.slice(3));
      setWaypoints((ws) => ws.map((w, idx) => (idx === i ? place : w)));
    }
    saveToHistory(place);
    setActiveInput(null);
    setQuery(""); // suggestions es derivado de activeInput+query → se vacía solo
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

  // Alternativa MÁS SEGURA a pie de noche (motor contextual lib/trip-safety): si por
  // poco más de tiempo reducís bastante la caminata nocturna, se marca ESA card con un
  // sello. De día devuelve null → no molesta. Sin reordenar: el usuario ve cuál es.
  const saferAlt = useMemo(() => {
    if (sortedRoutes.length < 2) return null;
    return saferAlternative(sortedRoutes, sortedRoutes.map((r) => r.totalSeconds), 0);
  }, [sortedRoutes]);

  // Métrica CORE de producto: ¿la gente logra planificar rutas? Es la acción que define
  // si la app cumple su función. Anónimo: solo fuente + cantidad de opciones + transbordos
  // del mejor (nada de direcciones ni coordenadas exactas). Una vez por par origen-destino.
  const planTracked = useRef<string>("");
  useEffect(() => {
    if (!from || !to) return;
    const n = usingGtfs ? sortedRoutes.length : heuristicRoutes.length;
    if (n === 0) return;
    const key = `${from.lat.toFixed(3)},${to.lat.toFixed(3)}`;
    if (planTracked.current === key) return;
    planTracked.current = key;
    track("plan_route", {
      source: usingGtfs ? "gtfs" : "heuristic",
      options: n,
      transfers: usingGtfs ? (sortedRoutes[0]?.numTransfers ?? -1) : -1,
    });
  }, [from, to, usingGtfs, sortedRoutes, heuristicRoutes]);

  const showSuggestions = activeInput !== null;

  function onVoiceToggle() {
    if (!voice.supported) {
      setVoiceError("Tu navegador bloquea la voz. Probá en Chrome 🙏");
      setTimeout(() => setVoiceError(null), 4500);
      return;
    }
    if (voice.state === "listening") voice.stop(); else voice.start();
  }

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--bg)", paddingTop: "max(env(safe-area-inset-top), 8px)" }}>
      {/* Header mobile */}
      <div className="app-header mobile-only" style={{ paddingLeft: 0, paddingRight: 0 }}>
        <LogoLockup size={24} ring="var(--text)" dot="var(--accent)" />
        {/* Honestidad (R73): sin GPS real no afirmamos "GPS activo" — gris + CTA (igual que el Home). */}
        {locationStatus === "pending" ? (
          <span style={{ font: "var(--font-badge)", color: "var(--text-3)" }}>Ubicando…</span>
        ) : locationIsReal ? (
          <span className="gps-dot" role="img" aria-label="GPS activo" />
        ) : (
          <button onClick={() => retryLocation()} className="gps-off" aria-label="Activá la ubicación">
            <span className="gps-dot off" /> Activá ubicación
          </button>
        )}
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

        {/* R73: los chips de hora/+Parada se ocultan mientras buscás un lugar — no son
            relevantes al elegir destino y descomprimen la pantalla (el search toma el foco). */}
        {!activeInput && (
          <DepartTimePicker value={departAt} onChange={setDepartAt}>
            {waypoints.length < 3 && (
              <button className="depart-chip" onClick={addWaypoint} aria-label="Agregar parada intermedia">
                <Icons.Plus size={14} /> Parada
              </button>
            )}
          </DepartTimePicker>
        )}
      </header>

      {/* Suggestions o resultados */}
      <div className="flex-1 overflow-y-auto pb-4 scrollbar-none" style={{ marginTop: 16 }}>
        <AnimatePresence mode="wait">
          {showSuggestions ? (
            <PlaceSearch
              key="search"
              query={query}
              onQueryChange={setQuery}
              placeholder={activeInput === "from" ? "Desde dónde…" : "A dónde vas…"}
              myLocation={activeInput === "from" && location && locationIsReal
                ? { name: "Mi ubicación", subtitle: "Posición actual", lat: location.lat, lon: location.lon }
                : null}
              history={history}
              suggestions={suggestions}
              searching={searching}
              voiceReady={mounted}
              voiceListening={voice.state === "listening"}
              onVoiceToggle={onVoiceToggle}
              voiceError={voiceError}
              onCancel={() => { setActiveInput(null); setQuery(""); voice.stop(); }}
              onPick={pickPlace}
              onChooseOnMap={() => { setActiveInput(null); setActiveTab("map"); }}
            />
          ) : (
            <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              {!from || !to ? (
                <PlannerEmptyState />
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
                      {/* R58: "Más rápido" → "Rápida": con 3 chips a 390px el último quedaba
                          cortado a la mitad ("Menos camina…") y parecía bug, no scroll. */}
                      {([["fast", "Rápida"], ["transfers", "Menos transbordos"], ["walk", "Menos caminata"]] as const).map(([k, label]) => (
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
                      safeBadge={saferAlt && saferAlt.idx === i ? saferAlt : null}
                      departAt={departAt}
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
                    <p className="text-[11px] text-amber-300/90 leading-tight">
                      <span className="font-bold">Estimación aproximada.</span> Usá las llegadas en vivo en cada parada para confirmar.
                    </p>
                  </div>
                  <p className="text-eyebrow mt-1">{routes.length} {routes.length === 1 ? "opción" : "opciones"} disponibles</p>
                  {routes.map((r, i) => (
                    <HeuristicRouteCard
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
