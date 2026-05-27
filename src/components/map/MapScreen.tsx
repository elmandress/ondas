"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useVehicles } from "@/hooks/useVehicles";
import { useLocation } from "@/hooks/useLocation";
import { useArrivals } from "@/hooks/useArrivals";
import { useStopsDataset } from "@/hooks/useStopsDataset";
import { useStopInfo } from "@/hooks/useStopInfo";
import { STOPS_DATASET, type BusStop, type VehiclePosition } from "@/lib/stm";
import { formatEta, etaColorClass, getStopsInBoundsClient, distanceTo } from "@/lib/utils";
import { loadRoutesCache, type RoutesIndex } from "@/lib/routes-cache";
import { filterUpstreamBuses } from "@/lib/bus-direction";
import { useSelectedPlace, setSelectedPlace } from "@/lib/selected-place";
import { useSelectedRoute, setSelectedRoute } from "@/lib/selected-route";
import { useNextArrivalForLine } from "@/hooks/useNextArrivalForLine";
import { useEnrichedRouteLegs } from "@/hooks/useEnrichedRouteLegs";
import { setRouteInput } from "@/lib/route-input";
import { setActiveTab } from "@/lib/active-tab";

const LeafletMap = dynamic(() => import("@/components/map/LeafletMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-[#0b1018] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm">Cargando mapa…</p>
      </div>
    </div>
  ),
});

interface Bounds { minLat: number; maxLat: number; minLon: number; maxLon: number; zoom: number; }
interface MapApi {
  flyTo: (lat: number, lon: number, zoom?: number) => void;
  fitBounds: (coords: [number, number][], padding?: number) => void;
}

export default function MapScreen() {
  const { location, isReal: locationIsReal } = useLocation();
  const { ready: stopsReady } = useStopsDataset();
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [filterLine, setFilterLine] = useState<string | null>(null);
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [visibleStops, setVisibleStops] = useState<BusStop[]>([]);
  const [mapApi, setMapApi] = useState<MapApi | null>(null);
  const [routesIdx, setRoutesIdx] = useState<RoutesIndex | null>(null);
  const selectedPlace = useSelectedPlace();
  const selectedRoute = useSelectedRoute();
  // Long-press en el mapa (FR-4.1): elegir punto para Cómo Llegar
  const [pinDrop, setPinDrop] = useState<{ lat: number; lon: number } | null>(null);

  // Cargar polylines una sola vez al montar (compartido con LeafletMap)
  useEffect(() => {
    let cancelled = false;
    loadRoutesCache().then((r) => {
      if (!cancelled) setRoutesIdx(r);
    });
    return () => { cancelled = true; };
  }, []);

  const center: [number, number] = location
    ? [location.lat, location.lon]
    : [-34.9058, -56.1882];

  // Auto-centrar en ubicación real al cargarla
  useEffect(() => {
    if (mapApi && location && locationIsReal) {
      mapApi.flyTo(location.lat, location.lon, 16);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapApi, locationIsReal]);

  // Paradas visibles según viewport (no muestra nada con zoom <14)
  useEffect(() => {
    if (!stopsReady || !bounds) return;
    if (bounds.zoom < 14) {
      setVisibleStops([]);
      return;
    }
    const limit = bounds.zoom >= 16 ? 400 : bounds.zoom >= 15 ? 200 : 100;
    setVisibleStops(getStopsInBoundsClient(bounds.minLat, bounds.maxLat, bounds.minLon, bounds.maxLon, limit));
  }, [bounds, stopsReady]);

  const selectedStop = useMemo(
    () => (selectedStopId ? STOPS_DATASET.find((s) => s.stopId === selectedStopId) : undefined),
    [selectedStopId, stopsReady]
  );

  // Líneas REALES de la parada (API STM, no shapefile viejo)
  const { info: stopInfo } = useStopInfo(selectedStopId);
  const realLines = useMemo<string[]>(
    () => stopInfo?.variants.map((v) => v.lineCode) || [],
    [stopInfo]
  );

  // Centrar mapa en la parada al seleccionarla
  useEffect(() => {
    if (selectedStop && mapApi) {
      mapApi.flyTo(selectedStop.stopLat, selectedStop.stopLon, 17);
    }
  }, [selectedStop, mapApi]);

  // SRS FR-3.8: cuando llega un lugar buscado, hacer fly-to y limpiar otras selecciones
  useEffect(() => {
    if (!selectedPlace) return;
    setSelectedStopId(null);
    setSelectedVehicleId(null);
    setFilterLine(null);
    if (mapApi) mapApi.flyTo(selectedPlace.lat, selectedPlace.lon, 16);
  }, [selectedPlace, mapApi]);

  // Enriquecemos los walk legs con OSRM (calles reales) — async, no bloquea render
  const enrichedLegs = useEnrichedRouteLegs(selectedRoute?.route ?? null);

  // Memoizar legs y endpoints de la ruta para que LeafletMap NO los reciba como
  // referencias nuevas en cada render (causaría loop infinito por el fitBounds → bounds → re-render).
  const routeLegsForMap = useMemo(
    () => enrichedLegs?.map((l) => ({
      type: l.type,
      polyline: l.polyline,
      lines: l.lines,
    })) ?? null,
    [enrichedLegs]
  );
  const routeEndpointsForMap = useMemo<{ origin: [number, number]; destination: [number, number] } | null>(
    () => selectedRoute
      ? {
          origin: [selectedRoute.origin.lat, selectedRoute.origin.lon],
          destination: [selectedRoute.destination.lat, selectedRoute.destination.lon],
        }
      : null,
    [selectedRoute]
  );

  // Paradas en radio 400m del lugar (FR-3.8)
  const placeNearbyStops = useMemo<{ stop: BusStop; distanceM: number }[]>(() => {
    if (!selectedPlace || !stopsReady) return [];
    const RADIUS_M = 400;
    return STOPS_DATASET
      .map((s) => ({ stop: s, distanceM: distanceTo(selectedPlace.lat, selectedPlace.lon, s.stopLat, s.stopLon) }))
      .filter((x) => x.distanceM <= RADIUS_M)
      .sort((a, b) => a.distanceM - b.distanceM)
      .slice(0, 8);
  }, [selectedPlace, stopsReady]);

  // Cuál línea(s) pedimos al hook de buses
  // - Sin parada: nada (devuelve [])
  // - Con parada y sin filtro: todas las líneas reales de la API
  // - Con parada y filtro: solo esa línea
  const linesForBuses: string[] | undefined = selectedStop
    ? (filterLine ? [filterLine] : (realLines.length > 0 ? realLines : undefined))
    : undefined;

  const { vehicles } = useVehicles(8000, {
    enabled: !!selectedStop && (realLines.length > 0 || !!filterLine),
    lineIds: linesForBuses,
    stopId: selectedStopId, // server usa API autenticada con filtro upstream oficial
  });

  const { arrivals, loading: arrivalsLoading, lastUpdated, refetch } = useArrivals(selectedStopId, 15000);

  // Filtros sobre buses (SRS FR-2):
  // NOTA: el filtro upstream ahora se hace SERVER-SIDE con la API oficial autenticada
  // (busstopId param). Acá solo aplicamos:
  //   1. línea seleccionada (chip de filtro adicional UI)
  //   2. GPS reciente (<3 min)
  //   3. Fallback client-side de upstream SOLO si el server no usó la API autenticada
  //      (detectado porque devuelve buses muy lejanos o sin filtrar)
  const filteredVehicles = useMemo<VehiclePosition[]>(() => {
    if (!selectedStop) return [];
    let list = vehicles;

    // 1. filtro por línea
    if (filterLine) {
      list = list.filter((v) => v.lineName === filterLine || v.lineId === filterLine);
    }

    // 2. descartar buses con GPS viejo (>3min)
    const STALE_MS = 3 * 60 * 1000;
    const now = Date.now();
    list = list.filter((v) => now - v.timestamp < STALE_MS);

    // 3. Filtro upstream client-side SOLO como red de seguridad:
    //    si vemos buses muy lejanos (>5km) probablemente el server no filtró bien,
    //    aplicamos nuestra heurística como fallback.
    if (routesIdx && list.length > 0) {
      const farCount = list.filter((v) => {
        const d = distanceTo(v.lat, v.lon, selectedStop.stopLat, selectedStop.stopLon);
        return d > 5000;
      }).length;
      if (farCount > list.length / 2) {
        list = filterUpstreamBuses(list, selectedStop.stopLat, selectedStop.stopLon, routesIdx);
      }
    }

    // Re-agregar el bus seleccionado si fue descartado por algún filtro
    if (selectedVehicleId && !list.find((v) => v.vehicleId === selectedVehicleId)) {
      const sv = vehicles.find((v) => v.vehicleId === selectedVehicleId);
      if (sv) list = [...list, sv];
    }
    return list;
  }, [vehicles, filterLine, selectedStop, selectedVehicleId, routesIdx]);

  // Paradas que se renderizan en el mapa
  // - Si hay parada seleccionada: solo esa (limpio, no satura)
  // - Si no: paradas del viewport
  // Paradas a renderizar en el mapa:
  //  - Si hay parada seleccionada → solo esa (limpio)
  //  - Si hay ruta planificada o lugar buscado → NINGUNA (saturan visualmente,
  //    el usuario quiere ver la ruta/destino sin ruido)
  //  - Sino: paradas del viewport
  const stopsForMap = useMemo<BusStop[]>(() => {
    if (selectedStop) return [selectedStop];
    if (selectedRoute || selectedPlace) return [];
    return visibleStops;
  }, [selectedStop, selectedRoute, selectedPlace, visibleStops]);

  const selectedVehicle = selectedVehicleId
    ? filteredVehicles.find((v) => v.vehicleId === selectedVehicleId)
    : undefined;

  function clearSelections() {
    setSelectedStopId(null);
    setSelectedVehicleId(null);
    setFilterLine(null);
    setSelectedPlace(null);
    setSelectedRoute(null);
  }

  return (
    <div className="flex flex-col h-full relative" style={{ background: "var(--bg)" }}>
      {/* ── TOP BAR ── */}
      <div className="absolute top-0 left-0 right-0 z-[1000] pt-[max(env(safe-area-inset-top),14px)] px-3 pb-2 pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="flex-1 bg-[#101626]/95 backdrop-blur-xl border border-white/[0.08] rounded-2xl px-3.5 py-2.5 flex items-center gap-2.5 shadow-lg">
            <svg className="w-4 h-4 text-blue-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="10" r="3" />
              <path d="M12 2a8 8 0 00-8 8c0 6 8 12 8 12s8-6 8-12a8 8 0 00-8-8z" />
            </svg>
            <div className="flex-1 min-w-0">
              {selectedRoute ? (
                <>
                  <p className="text-[10px] text-blue-400 font-bold leading-none">Ruta</p>
                  <p className="text-xs text-white font-semibold truncate leading-tight mt-0.5">
                    {selectedRoute.origin.name || "Origen"} → {selectedRoute.destination.name || "Destino"}
                  </p>
                </>
              ) : selectedPlace ? (
                <>
                  <p className="text-[10px] text-red-400 font-bold leading-none">Lugar</p>
                  <p className="text-xs text-white font-semibold truncate leading-tight mt-0.5">{selectedPlace.name}</p>
                </>
              ) : selectedStop ? (
                <>
                  <p className="text-[10px] text-blue-400 font-bold leading-none">Parada #{selectedStop.stopCode}</p>
                  <p className="text-xs text-white font-semibold truncate leading-tight mt-0.5">{selectedStop.stopName}</p>
                </>
              ) : (
                <>
                  <p className="text-xs text-white font-semibold leading-tight">
                    {!stopsReady
                      ? "Cargando paradas…"
                      : visibleStops.length > 0
                      ? `${visibleStops.length} paradas`
                      : bounds && bounds.zoom < 14
                      ? "Acercá el mapa para ver paradas"
                      : "Buscando paradas…"}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Tocá una parada para ver los buses</p>
                </>
              )}
            </div>
            {(selectedStop || selectedRoute || selectedPlace) && (
              <button
                onClick={clearSelections}
                className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center"
                aria-label="Cerrar"
              >
                <svg className="w-3.5 h-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Filtro por línea (cuando hay parada seleccionada y > 1 línea) */}
        {selectedStop && realLines.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none mt-2 pb-1 pointer-events-auto">
            <button
              onClick={() => setFilterLine(null)}
              className={`flex-shrink-0 px-2.5 h-7 rounded-lg text-[11px] font-bold transition-colors ${
                !filterLine ? "bg-blue-600 text-white" : "bg-[#101626]/85 text-slate-400 border border-white/[0.06]"
              }`}
            >
              Todas
            </button>
            {realLines.slice(0, 16).map((l) => (
              <button
                key={l}
                onClick={() => setFilterLine(filterLine === l ? null : l)}
                className={`flex-shrink-0 px-2.5 h-7 rounded-lg text-[11px] font-bold transition-colors ${
                  filterLine === l ? "bg-blue-600 text-white" : "bg-[#101626]/85 text-slate-400 border border-white/[0.06]"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── MAPA ── */}
      <div className="flex-1">
        <LeafletMap
          center={center}
          vehicles={filteredVehicles}
          stops={stopsForMap}
          selectedStopId={selectedStopId}
          selectedVehicleId={selectedVehicleId}
          placePin={
            selectedPlace && !selectedRoute
              ? { lat: selectedPlace.lat, lon: selectedPlace.lon, name: selectedPlace.name, icon: selectedPlace.icon }
              : null
          }
          routeLegs={routeLegsForMap}
          routeEndpoints={routeEndpointsForMap}
          onStopSelect={(id) => {
            setSelectedStopId(id);
            setSelectedVehicleId(null);
            setFilterLine(null);
          }}
          onVehicleSelect={setSelectedVehicleId}
          onMapClick={() => setSelectedVehicleId(null)}
          onMapLongPress={(lat, lon) => setPinDrop({ lat, lon })}
          onBoundsChange={setBounds}
          onReady={setMapApi}
        />
      </div>

      {/* ── PANEL DE PARADA ── */}
      <AnimatePresence>
        {selectedStop && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            className="absolute bottom-0 left-0 right-0 z-[1001]"
          >
            <div className="bg-[#0a0f1c]/97 backdrop-blur-xl border-t border-white/[0.07] rounded-t-3xl overflow-hidden shadow-[0_-12px_40px_rgba(0,0,0,0.6)]">
              <div className="flex justify-center pt-2.5 pb-1.5">
                <div className="w-9 h-[3px] rounded-full bg-white/15" />
              </div>

              <div className="px-4 pb-3 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-blue-400">Próximos buses</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {location && locationIsReal && (
                      <>{distanceTo(location.lat, location.lon, selectedStop.stopLat, selectedStop.stopLon)}m · </>
                    )}
                    {realLines.length || "—"} líneas
                    {lastUpdated && (
                      <span className="text-slate-700"> · {new Date(lastUpdated).toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" })}</span>
                    )}
                  </p>
                </div>
                <button
                  onClick={refetch}
                  className="w-9 h-9 rounded-xl bg-white/[0.06] flex items-center justify-center"
                  aria-label="Refrescar"
                >
                  <svg className={`w-3.5 h-3.5 text-slate-400 ${arrivalsLoading ? "animate-spin" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <polyline points="23 4 23 10 17 10" />
                    <polyline points="1 20 1 14 7 14" />
                    <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                  </svg>
                </button>
              </div>

              <div className="px-4 pb-5 max-h-[44vh] overflow-y-auto space-y-1.5">
                {arrivalsLoading && !arrivals.length ? (
                  [1, 2, 3, 4].map((i) => <div key={i} className="h-14 skeleton rounded-xl" />)
                ) : arrivals.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-slate-500 text-sm">Sin buses próximamente</p>
                    <p className="text-slate-700 text-xs mt-1">Tocá refrescar o esperá unos segundos</p>
                  </div>
                ) : (
                  arrivals.map((a, i) => {
                    const urgent = a.eta <= 2;
                    const soon = a.eta <= 8;
                    const liveBus = a.vehicleId ? filteredVehicles.find((v) => v.vehicleId === a.vehicleId) : undefined;
                    const hasLiveBus = !!liveBus;

                    return (
                      <motion.button
                        key={`${a.lineId}-${a.vehicleId || i}-${a.eta}`}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.02 }}
                        onClick={() => {
                          if (liveBus && mapApi) {
                            mapApi.flyTo(liveBus.lat, liveBus.lon, 17);
                            setSelectedVehicleId(liveBus.vehicleId);
                          }
                        }}
                        whileTap={hasLiveBus ? { scale: 0.98 } : undefined}
                        disabled={!hasLiveBus}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left ${hasLiveBus ? "cursor-pointer" : "cursor-default"}`}
                        style={{
                          background: urgent
                            ? "rgba(52,211,153,0.09)"
                            : soon
                            ? "rgba(251,191,36,0.05)"
                            : "rgba(255,255,255,0.03)",
                          border: urgent
                            ? "1px solid rgba(52,211,153,0.18)"
                            : soon
                            ? "1px solid rgba(251,191,36,0.1)"
                            : "1px solid rgba(255,255,255,0.04)",
                        }}
                      >
                        <div
                          className="w-11 h-11 rounded-lg flex items-center justify-center font-black text-xs text-white flex-shrink-0"
                          style={{ background: "rgba(255,255,255,0.07)", border: "1.5px solid rgba(255,255,255,0.12)" }}
                        >
                          {a.lineName}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{a.destination}</p>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            {a.realtime ? (
                              <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                En vivo
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-600">Estimado</span>
                            )}
                            {a.isShortened && (
                              <span className="text-[9px] bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded font-bold">Acortado</span>
                            )}
                            {/* SRS FR-6.3: accesibilidad REAL (dato oficial API IM) */}
                            {(a.access === "PISO BAJO" || a.access === "PLATAFORMA ELEVADORA") && (
                              <span className="text-[9px] bg-sky-500/15 text-sky-400 px-1.5 py-0.5 rounded font-bold" title={a.access}>♿ Accesible</span>
                            )}
                            {a.thermalConfort === "Aire Acondicionado" && (
                              <span className="text-[9px] bg-cyan-500/15 text-cyan-400 px-1.5 py-0.5 rounded font-bold" title="Aire acondicionado">❄ AC</span>
                            )}
                            {a.remainingStops !== undefined && a.remainingStops > 0 && (
                              <span className="text-[10px] text-slate-500" title="Paradas restantes del bus">· a {a.remainingStops} paradas</span>
                            )}
                            {a.remainingStops === undefined && a.distance && a.distance > 0 && a.distance < 30000 && (
                              <span className="text-[10px] text-slate-700">· {(a.distance / 1000).toFixed(1)}km</span>
                            )}
                            {hasLiveBus && (
                              <span className="ml-auto text-[10px] text-blue-400 font-semibold flex items-center gap-0.5">
                                Ver bus
                                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                                  <polyline points="9 18 15 12 9 6" />
                                </svg>
                              </span>
                            )}
                          </div>
                        </div>
                        <p
                          className={`text-xl font-black time-display flex-shrink-0 ${
                            urgent ? "text-emerald-400 countdown-urgent" : etaColorClass(a.eta)
                          }`}
                        >
                          {formatEta(a.eta)}
                        </p>
                      </motion.button>
                    );
                  })
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── PANEL DE RUTA PLANIFICADA (FR-4) ── */}
      <AnimatePresence>
        {selectedRoute && !selectedStop && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            className="absolute bottom-0 left-0 right-0 z-[1001]"
            style={{ maxHeight: "70vh" }}
          >
            <div
              className="bg-[#0a0f1c]/97 backdrop-blur-xl border-t border-white/[0.07] rounded-t-3xl overflow-hidden shadow-[0_-12px_40px_rgba(0,0,0,0.6)] flex flex-col"
              style={{ maxHeight: "70vh" }}
            >
              <div className="flex justify-center pt-2.5 pb-1.5">
                <div className="w-9 h-[3px] rounded-full bg-white/15" />
              </div>

              <div className="px-4 pb-3 flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                     style={{ background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.3)" }}>
                  <svg className="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <polygon points="3 11 22 2 13 21 11 13 3 11"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-blue-400">Ruta</p>
                  <p className="text-sm text-white font-bold truncate">
                    {selectedRoute.origin.name || "Origen"} → {selectedRoute.destination.name || "Destino"}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {Math.max(1, Math.round(selectedRoute.route.totalSeconds / 60))} min ·{" "}
                    {selectedRoute.route.numTransfers === 0 ? "directa" : `${selectedRoute.route.numTransfers} transbordo${selectedRoute.route.numTransfers > 1 ? "s" : ""}`}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedRoute(null)}
                  className="w-9 h-9 rounded-xl bg-white/[0.06] flex items-center justify-center flex-shrink-0"
                  aria-label="Cerrar ruta"
                >
                  <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              <div className="px-4 pb-5 overflow-y-auto space-y-2 flex-1 min-h-0">
                {selectedRoute.route.legs.map((leg, i) => {
                  const minutes = Math.max(1, Math.round(leg.durationS / 60));
                  if (leg.type === "walk") {
                    const isLast = i === selectedRoute.route.legs.length - 1;
                    return (
                      <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-emerald-500/[0.07] border border-emerald-500/15">
                        <div className="w-9 h-9 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                          <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                            <circle cx="12" cy="5" r="1"/><path d="M9 20l3-9"/><path d="M13 13l2 4"/><path d="M7 20h3"/>
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white">Caminá {minutes} min</p>
                          <p className="text-[11px] text-slate-500">
                            {leg.distanceM}m {isLast ? "hasta el destino" : leg.toStopName ? `hasta ${leg.toStopName}` : "hasta la parada"}
                          </p>
                        </div>
                      </div>
                    );
                  }
                  const line = leg.lines?.[0] || "?";
                  return (
                    <BusLegRow
                      key={i}
                      line={line}
                      headsign={leg.headsign || ""}
                      fromStopId={leg.fromStopId}
                      fromStopName={leg.fromStopName}
                      numStops={leg.numStops}
                      minutes={minutes}
                      onTapStop={(id) => setSelectedStopId(id)}
                    />
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── PANEL DE LUGAR BUSCADO (FR-3.8) ── */}
      {/* Aparece cuando el usuario selecciona un lugar desde el buscador.
          Muestra el lugar pineado en el mapa y la lista de paradas cercanas con sus líneas. */}
      <AnimatePresence>
        {selectedPlace && !selectedStop && !selectedRoute && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            className="absolute bottom-0 left-0 right-0 z-[1001]"
          >
            <div className="bg-[#0a0f1c]/97 backdrop-blur-xl border-t border-white/[0.07] rounded-t-3xl overflow-hidden shadow-[0_-12px_40px_rgba(0,0,0,0.6)]">
              <div className="flex justify-center pt-2.5 pb-1.5">
                <div className="w-9 h-[3px] rounded-full bg-white/15" />
              </div>

              <div className="px-4 pb-3 flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 text-xl"
                     style={{ background: "rgba(220,38,38,0.15)", border: "1px solid rgba(220,38,38,0.3)" }}>
                  {selectedPlace.icon || "📍"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-red-400">Lugar</p>
                  <p className="text-sm text-white font-bold truncate">{selectedPlace.name}</p>
                  {selectedPlace.fullName && (
                    <p className="text-[10px] text-slate-600 truncate">{selectedPlace.fullName.split(",").slice(0, 2).join(",")}</p>
                  )}
                </div>
                <button
                  onClick={() => setSelectedPlace(null)}
                  className="w-9 h-9 rounded-xl bg-white/[0.06] flex items-center justify-center flex-shrink-0"
                  aria-label="Cerrar lugar"
                >
                  <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              <div className="px-4 pb-5 max-h-[44vh] overflow-y-auto">
                {placeNearbyStops.length === 0 ? (
                  <div className="py-6 text-center">
                    <p className="text-slate-500 text-sm">Sin paradas a menos de 400m</p>
                    <p className="text-slate-700 text-xs mt-1">Probá un lugar más cercano al centro</p>
                  </div>
                ) : (
                  <>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2.5">
                      Paradas cercanas ({placeNearbyStops.length})
                    </p>
                    <div className="space-y-1.5">
                      {placeNearbyStops.map(({ stop, distanceM }, i) => (
                        <motion.button
                          key={stop.stopId}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.03 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            setSelectedStopId(stop.stopId);
                            setSelectedVehicleId(null);
                            setFilterLine(null);
                          }}
                          className="w-full text-left bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.05] rounded-xl px-3 py-2.5 flex items-center gap-3"
                        >
                          <div className="w-9 h-9 rounded-lg bg-white/[0.06] flex items-center justify-center flex-shrink-0">
                            <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                              <rect x="2" y="6" width="20" height="12" rx="2"/>
                              <path d="M22 10H2"/>
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white truncate">{stop.stopName}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-blue-400 font-medium">{distanceM}m</span>
                              <span className="text-[10px] text-slate-700">·</span>
                              <span className="text-[10px] text-slate-500">#{stop.stopCode}</span>
                              <div className="flex gap-1 ml-1">
                                {stop.lines.slice(0, 5).map((l) => (
                                  <span key={l} className="text-[9px] font-bold text-slate-300 px-1 py-0 rounded bg-white/[0.06]">{l}</span>
                                ))}
                                {stop.lines.length > 5 && (
                                  <span className="text-[9px] text-slate-700">+{stop.lines.length - 5}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <svg className="w-4 h-4 text-slate-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                            <polyline points="9 18 15 12 9 6"/>
                          </svg>
                        </motion.button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── INFO VEHÍCULO SELECCIONADO (sobre el panel de parada si hay) ── */}
      <AnimatePresence>
        {selectedVehicle && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", damping: 26, stiffness: 280 }}
            className="absolute left-3 right-3 z-[1002]"
            style={{ bottom: selectedStop ? "calc(48vh + 12px)" : "20px" }}
          >
            <div className="bg-[#0a0f1c]/95 backdrop-blur-xl rounded-2xl p-3 border border-blue-500/30 shadow-2xl">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center font-black text-sm text-white flex-shrink-0"
                    style={{ background: "rgba(59,130,246,0.18)", border: "2px solid rgba(59,130,246,0.5)" }}
                  >
                    {selectedVehicle.lineName}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-white font-bold text-sm truncate">{selectedVehicle.destinoDesc || `Línea ${selectedVehicle.lineName}`}</p>
                    <p className="text-slate-500 text-[11px] truncate">
                      Bus #{selectedVehicle.vehicleId}
                      {selectedVehicle.speed > 0 && <> · {Math.round(selectedVehicle.speed)} km/h</>}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedVehicleId(null)}
                  className="w-8 h-8 rounded-xl bg-white/[0.06] flex items-center justify-center flex-shrink-0"
                  aria-label="Cerrar"
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

      {/* ── POPUP LONG-PRESS (FR-4.1): elegir punto como origen/destino ── */}
      <AnimatePresence>
        {pinDrop && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="absolute left-3 right-3 z-[1005]"
            style={{ top: "calc(env(safe-area-inset-top) + 70px)" }}
          >
            <div className="bg-[#0a0f1c]/97 backdrop-blur-xl rounded-2xl p-3 border border-blue-500/30 shadow-2xl">
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-blue-400 mb-1">Punto seleccionado</p>
              <p className="text-[11px] text-slate-400 mb-2.5">
                {pinDrop.lat.toFixed(4)}, {pinDrop.lon.toFixed(4)}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setRouteInput({ slot: "from", point: { lat: pinDrop.lat, lon: pinDrop.lon, name: "Punto en el mapa" } });
                    setPinDrop(null);
                    setActiveTab("route");
                  }}
                  className="flex-1 py-2 rounded-xl text-xs font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30"
                >
                  Desde aquí
                </button>
                <button
                  onClick={() => {
                    setRouteInput({ slot: "to", point: { lat: pinDrop.lat, lon: pinDrop.lon, name: "Punto en el mapa" } });
                    setPinDrop(null);
                    setActiveTab("route");
                  }}
                  className="flex-1 py-2 rounded-xl text-xs font-bold text-red-300 bg-red-500/15 border border-red-500/30"
                >
                  Hasta aquí
                </button>
                <button
                  onClick={() => setPinDrop(null)}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 bg-white/[0.05]"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Botón flotante: centrar en mi ubicación */}
      {location && locationIsReal && (
        <button
          onClick={() => mapApi?.flyTo(location.lat, location.lon, 16)}
          className="absolute right-4 z-[1000] w-12 h-12 rounded-full bg-[#101626]/95 backdrop-blur-xl border border-white/[0.08] flex items-center justify-center shadow-xl active:scale-95 transition-transform"
          style={{ bottom: selectedStop ? "calc(48vh + 16px)" : "24px" }}
          aria-label="Centrar en mi ubicación"
        >
          <svg className="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </svg>
        </button>
      )}

      {/* Hint zoom bajo */}
      {bounds && bounds.zoom < 14 && !selectedStop && stopsReady && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[999] pointer-events-none">
          <div className="bg-[#0a0f1c]/90 backdrop-blur-xl rounded-full px-4 py-2 border border-white/[0.08] flex items-center gap-2 shadow-xl">
            <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8" /><path d="M11 8v6M8 11h6" />
            </svg>
            <p className="text-xs text-slate-300 font-medium">Acercá para ver paradas</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── BusLegRow ─────────────────────────────────────────────────────
// Fila del panel de ruta para un leg de bus, con ETA en vivo (FR-4.4).
function BusLegRow({
  line, headsign, fromStopId, fromStopName, numStops, minutes, onTapStop,
}: {
  line: string;
  headsign: string;
  fromStopId?: string;
  fromStopName?: string;
  numStops?: number;
  minutes: number;
  onTapStop: (id: string) => void;
}) {
  const { etaMin, realtime, loading } = useNextArrivalForLine(fromStopId, line);

  return (
    <button
      onClick={() => fromStopId && onTapStop(fromStopId)}
      className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl bg-blue-500/[0.08] border border-blue-500/20"
    >
      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 font-black text-xs text-white"
           style={{ background: "var(--accent)" }}>
        {line}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white">
          Tomá el {line} hacia {headsign.split(" ").slice(0, 4).join(" ")}
        </p>
        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
          <p className="text-[11px] text-slate-500 truncate">
            {fromStopName} · {numStops} paradas · {minutes} min
          </p>
        </div>
        {/* ETA EN VIVO */}
        {loading ? (
          <p className="text-[10px] text-slate-600 mt-0.5">Buscando próximo…</p>
        ) : etaMin !== null ? (
          <p className={`text-[11px] font-bold mt-0.5 ${
            etaMin <= 3 ? "text-emerald-400" : etaMin <= 10 ? "text-amber-400" : "text-blue-400"
          }`}>
            {realtime ? "● Próximo " : "○ Próximo (horario) "}
            en {etaMin === 0 ? "<1" : etaMin} min
          </p>
        ) : (
          <p className="text-[10px] text-slate-600 mt-0.5">Sin próximos por ahora</p>
        )}
      </div>
      <svg className="w-4 h-4 text-slate-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </button>
  );
}
