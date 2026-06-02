"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useVehicles } from "@/hooks/useVehicles";
import { useInteriorBuses } from "@/hooks/useInteriorBuses";
import { useLocation } from "@/hooks/useLocation";
import { useArrivals } from "@/hooks/useArrivals";
import { useStopsDataset } from "@/hooks/useStopsDataset";
import { useStopInfo } from "@/hooks/useStopInfo";
import { STOPS_DATASET, type BusStop, type VehiclePosition } from "@/lib/stm";
import { getStopsInBoundsClient, distanceTo } from "@/lib/utils";
import { loadRoutesCache, type RoutesIndex } from "@/lib/routes-cache";
import { filterUpstreamBuses } from "@/lib/bus-direction";
import { useSelectedPlace, setSelectedPlace } from "@/lib/selected-place";
import { useSelectedRoute, setSelectedRoute } from "@/lib/selected-route";
import { useNextArrivalForLine } from "@/hooks/useNextArrivalForLine";
import { useEnrichedRouteLegs } from "@/hooks/useEnrichedRouteLegs";
import { setRouteInput } from "@/lib/route-input";
import { setActiveTab } from "@/lib/active-tab";
import { speak } from "@/lib/voice-alerts";
import LineBadge from "@/components/ui/LineBadge";
import ArrivalRow from "@/components/ui/ArrivalRow";
import { Icons } from "@/components/brand/Icons";
import EmptyState from "@/components/ui/EmptyState";
import LineDetailSheet from "@/components/home/LineDetailSheet";

const LeafletMap = dynamic(() => import("@/components/map/LeafletMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-[#070b14] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
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
  // Detalle de línea (mismo menú que Inicio→parada): recorrido completo, empresa, wifi.
  const [lineDetail, setLineDetail] = useState<{ line: string; destination?: string; company?: string } | null>(null);
  const [filterLine, setFilterLine] = useState<string | null>(null);
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [visibleStops, setVisibleStops] = useState<BusStop[]>([]);
  const [mapApi, setMapApi] = useState<MapApi | null>(null);
  const [routesIdx, setRoutesIdx] = useState<RoutesIndex | null>(null);
  const selectedPlace = useSelectedPlace();
  const selectedRoute = useSelectedRoute();
  // Long-press en el mapa (FR-4.1): elegir punto para Cómo Llegar
  const [pinDrop, setPinDrop] = useState<{ lat: number; lon: number } | null>(null);
  const [pinName, setPinName] = useState<string | null>(null); // null = "Buscando dirección…"
  const pinDropTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-dismiss pinDrop después de 12s si el usuario lo ignora
  useEffect(() => {
    if (pinDropTimerRef.current) clearTimeout(pinDropTimerRef.current);
    if (pinDrop) {
      pinDropTimerRef.current = setTimeout(() => setPinDrop(null), 12000);
    }
    return () => { if (pinDropTimerRef.current) clearTimeout(pinDropTimerRef.current); };
  }, [pinDrop]);

  // Reverse-geocode del punto fijado (feedback instantáneo: marcador ya está; el
  // nombre llega después, sin bloquear). Optimista: "Buscando dirección…" → dirección.
  useEffect(() => {
    if (!pinDrop) { setPinName(null); return; }
    setPinName(null);
    let cancelled = false;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    fetch(`/api/geocode?lat=${pinDrop.lat}&lon=${pinDrop.lon}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d?.name) setPinName(d.name); })
      .catch(() => {})
      .finally(() => clearTimeout(t));
    return () => { cancelled = true; ctrl.abort(); };
  }, [pinDrop]);

  // routes.json pesa ~3.9MB: lo cargamos SOLO cuando se elige una parada (ahí se usa
  // para filtrar buses que van hacia ella). Abrir el mapa a mirar NO baja ese peso.
  // El cache es compartido (loadRoutesCache memoiza), así que se baja una sola vez.
  useEffect(() => {
    if (!selectedStopId || routesIdx) return;
    let cancelled = false;
    loadRoutesCache().then((r) => {
      if (!cancelled) setRoutesIdx(r);
    });
    return () => { cancelled = true; };
  }, [selectedStopId, routesIdx]);

  const center: [number, number] = location
    ? [location.lat, location.lon]
    : [-34.9058, -56.1882];

  // Buses del INTERIOR en vivo (GPS Busmatick) si estás mirando una zona cubierta
  // (Maldonado, Paysandú, Rivera). Usa el centro del viewport actual.
  const viewLat = bounds ? (bounds.minLat + bounds.maxLat) / 2 : center[0];
  const viewLon = bounds ? (bounds.minLon + bounds.maxLon) / 2 : center[1];
  const interiorBuses = useInteriorBuses(viewLat, viewLon);

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
      fromStopName: l.fromStopName,
      toStopName: l.toStopName,
      durationS: l.durationS,
      distanceM: l.distanceM,
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

  const { arrivals, loading: arrivalsLoading, lastUpdated, lastFetchFailed: arrivalsFetchFailed, isOffline: arrivalsOffline, refetch } = useArrivals(selectedStopId, 15000);

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

  // Markers del mapa = vehículos del endpoint + posiciones de los arrivals en vivo que
  // ese endpoint no trajo. arrivals y vehicles son DOS llamadas separadas a la API en vivo
  // y devuelven sets distintos → sin esto, la lista muestra "en vivo" pero el mapa no tiene
  // el marker ("hago clic y no aparece el bondi"). Los arrivals ya están limpios (sin pasados).
  const vehiclesForMap = useMemo<VehiclePosition[]>(() => {
    const byId = new Map<string, VehiclePosition>();
    for (const v of filteredVehicles) byId.set(v.vehicleId, v);
    for (const a of arrivals) {
      if (!a.realtime || !a.vehicleId) continue;
      if (typeof a.lat !== "number" || typeof a.lon !== "number") continue;
      if (byId.has(a.vehicleId)) continue;
      if (filterLine && a.lineName !== filterLine && a.lineId !== filterLine) continue;
      byId.set(a.vehicleId, {
        vehicleId: a.vehicleId, lineId: a.lineId, lineName: a.lineName,
        lat: a.lat, lon: a.lon, bearing: 0, speed: 0, timestamp: Date.now(),
        destinoDesc: a.destination,
      });
    }
    // Buses del interior (GPS en vivo Busmatick) cuando mirás esa zona. No los
    // filtra el upstream de MVD (son fuente propia), se muestran tal cual.
    for (const b of interiorBuses) {
      if (!byId.has(b.vehicleId)) byId.set(b.vehicleId, b);
    }
    const all = [...byId.values()];
    // Si estás SIGUIENDO un bus, mostramos SOLO ese (lo pediste): el mapa se enfoca
    // en tu bus, sin el ruido de los demás. Al cerrar el seguimiento, vuelven todos.
    if (selectedVehicleId) {
      const only = all.filter((v) => v.vehicleId === selectedVehicleId);
      if (only.length) return only;
    }
    return all;
  }, [filteredVehicles, arrivals, filterLine, selectedVehicleId, interiorBuses]);

  // Paradas que se renderizan en el mapa
  // - Si hay parada seleccionada: solo esa (limpio, no satura)
  // - Si no: paradas del viewport
  // Paradas a renderizar en el mapa:
  //  - Si hay parada seleccionada → solo esa (limpio)
  //  - Si hay ruta planificada o lugar buscado → NINGUNA (saturan visualmente,
  //    el usuario quiere ver la ruta/destino sin ruido)
  //  - Sino: paradas del viewport (incluye las del interior, ya fusionadas en el dataset)
  const stopsForMap = useMemo<BusStop[]>(() => {
    if (selectedStop) return [selectedStop];
    if (selectedRoute || selectedPlace) return [];
    return visibleStops;
  }, [selectedStop, selectedRoute, selectedPlace, visibleStops]);

  const selectedVehicle = selectedVehicleId
    ? vehiclesForMap.find((v) => v.vehicleId === selectedVehicleId)
    : undefined;

  // Alerta "bajate ahora / prepárate": si estás siguiendo un bus que va hacia la parada
  // seleccionada, su ETA sale de los arrivals. ≤1 min = ¡ya!; ≤3 = preparate. (Idea Moovit.)
  const followedEta = useMemo(() => {
    if (!selectedVehicleId || !selectedStop) return null;
    const a = arrivals.find((x) => x.vehicleId === selectedVehicleId && x.realtime);
    return a ? a.eta : null;
  }, [selectedVehicleId, selectedStop, arrivals]);
  const followAlert = followedEta != null && followedEta <= 3
    ? (followedEta <= 1 ? "now" : "soon") as "now" | "soon"
    : null;

  // Aviso por VOZ del "preparate / bajate" — accesibilidad y manos libres (opt-in en
  // Ajustes). Solo habla cuando el estado CAMBIA (ref), para no repetir cada refresh.
  const lastSpokenAlert = useRef<"now" | "soon" | null>(null);
  useEffect(() => {
    if (followAlert === lastSpokenAlert.current) return;
    lastSpokenAlert.current = followAlert;
    if (followAlert === "soon") speak("Preparate, tu bus está por llegar a tu parada.");
    else if (followAlert === "now") speak("¡Bajate ahora! Tu bus está llegando.");
  }, [followAlert]);

  function clearSelections() {
    setSelectedStopId(null);
    setSelectedVehicleId(null);
    setFilterLine(null);
    setSelectedPlace(null);
    setSelectedRoute(null);
  }

  return (
    <div className="map-fullbleed flex flex-col h-full relative" style={{ background: "var(--bg)" }}>
      {/* ── TOP BAR ── (oculto cuando hay parada: la hoja ya muestra todo) */}
      {!selectedStop && (
      <div className="map-top-bar absolute top-0 left-0 right-0 z-[1000] pt-[max(env(safe-area-inset-top),14px)] px-3 pb-2 pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="flex-1 bg-[#101626]/95 backdrop-blur-xl border border-white/[0.08] rounded-2xl px-3.5 py-2.5 flex items-center gap-2.5 shadow-lg">
            <svg className="w-4 h-4 text-amber-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="10" r="3" />
              <path d="M12 2a8 8 0 00-8 8c0 6 8 12 8 12s8-6 8-12a8 8 0 00-8-8z" />
            </svg>
            <div className="flex-1 min-w-0">
              {selectedRoute ? (
                <>
                  <p className="text-[10px] text-amber-400 font-bold leading-none">Ruta</p>
                  <p className="text-xs text-white font-semibold truncate leading-tight mt-0.5">
                    {selectedRoute.origin.name || "Origen"} → {selectedRoute.destination.name || "Destino"}
                  </p>
                </>
              ) : selectedPlace ? (
                <>
                  <p className="text-[10px] text-red-400 font-bold leading-none">Lugar</p>
                  <p className="text-xs text-white font-semibold truncate leading-tight mt-0.5">{selectedPlace.name}</p>
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

        {/* El filtro de líneas ahora vive DENTRO de la hoja de parada (menos chrome flotante). */}
      </div>
      )}

      {/* ── MAPA ── */}
      <div className="flex-1">
        <LeafletMap
          center={center}
          vehicles={vehiclesForMap}
          stops={stopsForMap}
          selectedStopId={selectedStopId}
          selectedVehicleId={selectedVehicleId}
          placePin={
            pinDrop
              ? { lat: pinDrop.lat, lon: pinDrop.lon, name: pinName ?? "Punto seleccionado", icon: "📍" }
              : selectedPlace && !selectedRoute
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
        {selectedStop && !selectedVehicleId && (
          <div className="map-stop-panel absolute bottom-0 left-0 right-0 z-[1001]">
            <div className="map-stop-panel-inner bg-[#0a0f1c]/97 backdrop-blur-xl border-t border-white/[0.07] rounded-t-3xl overflow-hidden shadow-[0_-12px_40px_rgba(0,0,0,0.6)]">
              <div className="map-panel-handle flex justify-center pt-2.5 pb-1.5">
                <div className="w-9 h-[3px] rounded-full bg-white/15" />
              </div>

              <div className="px-4 pb-2 flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-[0.16em] text-amber-400">Parada #{selectedStop.stopCode}</p>
                  <p className="text-[16px] font-bold text-white leading-tight mt-1 truncate">{selectedStop.stopName}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {location && locationIsReal && (
                      <>{distanceTo(location.lat, location.lon, selectedStop.stopLat, selectedStop.stopLon)}m · </>
                    )}
                    {realLines.length || "—"} líneas
                    {arrivalsOffline && <span className="text-amber-600"> · sin conexión</span>}
                    {!arrivalsOffline && lastUpdated && (
                      <span className={arrivalsFetchFailed ? "text-amber-700" : "text-slate-700"}>
                        {" · "}{arrivalsFetchFailed ? "Error " : ""}{new Date(lastUpdated).toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                  </p>
                </div>
                <button onClick={refetch} className="w-9 h-9 rounded-xl bg-white/[0.06] flex items-center justify-center flex-shrink-0" aria-label="Refrescar">
                  <svg className={`w-3.5 h-3.5 text-slate-400 ${arrivalsLoading ? "animate-spin" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <polyline points="23 4 23 10 17 10" />
                    <polyline points="1 20 1 14 7 14" />
                    <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                  </svg>
                </button>
                <button onClick={clearSelections} className="w-9 h-9 rounded-xl bg-white/[0.06] flex items-center justify-center flex-shrink-0" aria-label="Cerrar">
                  <svg className="w-3.5 h-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* Filtro de líneas DENTRO de la hoja (antes flotaba sobre el mapa) */}
              {realLines.length > 1 && (
                <div className="px-4 pb-2.5 flex gap-1.5 overflow-x-auto scrollbar-none">
                  <button
                    onClick={() => setFilterLine(null)}
                    className="flex-shrink-0 px-3 h-8 rounded-lg text-[12px] font-bold flex items-center"
                    style={!filterLine ? { background: "var(--accent)", color: "#1a1206" } : { background: "var(--surface)", color: "var(--text-2)", border: "1px solid var(--border-strong)" }}
                  >
                    Todas
                  </button>
                  {realLines.slice(0, 16).map((l) => {
                    const on = filterLine === l;
                    return (
                      <button
                        key={l}
                        onClick={() => setFilterLine(on ? null : l)}
                        className="flex-shrink-0 px-3 h-8 rounded-lg text-[12px] font-bold flex items-center"
                        style={on ? { background: "var(--accent)", color: "#1a1206" } : { background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border-strong)" }}
                      >
                        {l}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="map-panel-scroll px-4 max-h-[44vh] overflow-y-auto"
                   style={{ paddingBottom: "calc(20px + env(safe-area-inset-bottom))" }}>
                {arrivalsLoading && !arrivals.length ? (
                  [1, 2, 3, 4].map((i) => <div key={i} className="h-14 skeleton rounded-xl" />)
                ) : arrivals.length === 0 ? (
                  arrivalsOffline ? (
                    <EmptyState emoji="📡" title="Sin conexión" sub="No hay internet ahora. Cuando vuelva, actualizamos solos." onRetry={refetch} />
                  ) : arrivalsFetchFailed ? (
                    <EmptyState emoji="💤" title="Los servidores del STM están durmiendo" sub="No pudimos traer las llegadas ahora. Probá de nuevo." onRetry={refetch} />
                  ) : (
                    <EmptyState icon={<Icons.Bus size={28} />} title="Sin buses próximamente" sub="No hay servicios en los próximos minutos." />
                  )
                ) : (
                  arrivals.map((a, i) => {
                    const liveBus = a.vehicleId ? vehiclesForMap.find((v) => v.vehicleId === a.vehicleId) : undefined;
                    // Seguir funciona para CUALQUIER bus en vivo usando su propia posición
                    // (no depende de que esté en filteredVehicles → trackeable en toda parada).
                    const followLat = liveBus?.lat ?? a.lat;
                    const followLon = liveBus?.lon ?? a.lon;
                    const canFollow = a.realtime && typeof followLat === "number" && typeof followLon === "number" && !!mapApi;
                    return (
                      <ArrivalRow
                        key={`${a.lineId}-${a.vehicleId || i}-${a.eta}`}
                        arrival={a}
                        stopId={selectedStopId ?? undefined}
                        onLinePress={(line, destination, company) => setLineDetail({ line, destination, company })}
                        following={!!a.vehicleId && selectedVehicleId === a.vehicleId}
                        onFollow={canFollow ? () => {
                          mapApi!.flyTo(followLat!, followLon!, 17);
                          if (a.vehicleId) setSelectedVehicleId(a.vehicleId);
                        } : undefined}
                      />
                    );
                  })
                )}
              </div>
            </div>
          </div>
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
            className="map-overlay-card absolute bottom-0 left-0 right-0 z-[1001]"
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
                     style={{ background: "rgba(240,160,32,0.15)", border: "1px solid rgba(240,160,32,0.3)" }}>
                  <svg className="w-5 h-5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <polygon points="3 11 22 2 13 21 11 13 3 11"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-amber-400">Ruta</p>
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

              <div className="px-4 overflow-y-auto flex-1 min-h-0"
                   style={{ paddingBottom: "calc(24px + env(safe-area-inset-bottom))" }}>
                {selectedRoute.route.legs.map((leg, i) => {
                  const minutes = Math.max(1, Math.round(leg.durationS / 60));
                  if (leg.type === "walk") {
                    const isLast = i === selectedRoute.route.legs.length - 1;
                    return (
                      <div key={i} className="flex items-center gap-3 py-3.5" style={{ borderBottom: "1px solid var(--border)" }}>
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "var(--surface)", color: "var(--text-2)" }}>
                          <Icons.Walk size={17} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[15px] font-semibold text-white">Caminá {minutes} min</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {leg.distanceM}m {isLast ? "hasta el destino" : leg.toStopName ? `hasta ${leg.toStopName}` : "hasta la parada"}
                          </p>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <BusLegRow
                      key={i}
                      lines={leg.lines || []}
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
            className="map-overlay-card absolute bottom-0 left-0 right-0 z-[1001]"
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
                              <span className="text-[10px] text-amber-400 font-medium">{distanceM}m</span>
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
            className={`map-overlay-card map-vehicle-card absolute left-3 right-3 z-[1002] ${selectedStop ? "above-panel" : ""}`}
            style={{ bottom: "calc(20px + env(safe-area-inset-bottom))" }}
          >
            {/* Alerta "prepárate / ¡bajate!": el bus seguido está por llegar a tu parada. */}
            {followAlert && (
              <div className={`follow-alert ${followAlert}`}>
                <Icons.Bus size={16} />
                <span>{followAlert === "now"
                  ? "¡Está llegando! Salí a la parada ahora"
                  : `Llega en ${followedEta} min — prepárate`}</span>
              </div>
            )}
            <div className="bg-[#0a0f1c]/95 backdrop-blur-xl rounded-2xl p-3 border border-amber-500/30 shadow-2xl">
              <div className="flex items-center justify-between gap-2">
                {/* Tocar el bus/badge → abre el MISMO detalle de línea que en Inicio:
                    recorrido completo, paradas, tiempos, empresa, web, wifi. */}
                <button
                  className="flex items-center gap-3 min-w-0 flex-1 text-left"
                  onClick={() => setLineDetail({ line: selectedVehicle.lineName, destination: selectedVehicle.destinoDesc, company: selectedVehicle.company })}
                >
                  <LineBadge num={selectedVehicle.lineName} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="text-white font-bold text-sm truncate">{selectedVehicle.destinoDesc || `Línea ${selectedVehicle.lineName}`}</p>
                    {/* Datos ricos del GPS del interior (próxima parada / atraso / ocupación). */}
                    {(selectedVehicle.nextStop || selectedVehicle.delayMin != null || selectedVehicle.occupancy != null) && (
                      <p className="text-[11px] truncate mt-0.5">
                        {selectedVehicle.nextStop && <span className="text-slate-300">→ {selectedVehicle.nextStop}</span>}
                        {selectedVehicle.delayMin != null && Math.abs(selectedVehicle.delayMin) >= 1 && (
                          <span className={selectedVehicle.delayMin > 0 ? "text-amber-400" : "text-emerald-400"}>
                            {" · "}{selectedVehicle.delayMin > 0 ? `${selectedVehicle.delayMin} min tarde` : `${-selectedVehicle.delayMin} min adelantado`}
                          </span>
                        )}
                        {selectedVehicle.occupancy != null && selectedVehicle.occupancy > 0 && (
                          <span className="text-slate-400">{" · "}~{selectedVehicle.occupancy} pasajeros</span>
                        )}
                      </p>
                    )}
                    <p className="text-slate-500 text-[11px] truncate">
                      Bus #{selectedVehicle.vehicleId}
                      {selectedVehicle.speed > 0 && <> · {Math.round(selectedVehicle.speed)} km/h</>}
                      <span className="text-amber-400 font-semibold"> · Ver recorrido ›</span>
                    </p>
                  </div>
                </button>
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
            <div className="bg-[#0a0f1c]/97 backdrop-blur-xl rounded-2xl p-3 border border-amber-500/30 shadow-2xl">
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-amber-400 mb-1">Punto seleccionado</p>
              <p className="text-[12px] text-white font-semibold mb-0.5 truncate">
                {pinName ?? "Buscando dirección…"}
              </p>
              <p className="text-[10px] text-slate-500 mb-2.5">
                {pinDrop.lat.toFixed(4)}, {pinDrop.lon.toFixed(4)}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setRouteInput({ slot: "from", point: { lat: pinDrop.lat, lon: pinDrop.lon, name: pinName ?? "Punto en el mapa" } });
                    setPinDrop(null);
                    setActiveTab("route");
                  }}
                  className="flex-1 py-2 rounded-xl text-xs font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30"
                >
                  Desde aquí
                </button>
                <button
                  onClick={() => {
                    setRouteInput({ slot: "to", point: { lat: pinDrop.lat, lon: pinDrop.lon, name: pinName ?? "Punto en el mapa" } });
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
          <svg className="w-5 h-5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </svg>
        </button>
      )}

      {/* Hint zoom bajo */}
      {bounds && bounds.zoom < 14 && !selectedStop && stopsReady && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[999] pointer-events-none">
          <div className="bg-[#0a0f1c]/90 backdrop-blur-xl rounded-full px-4 py-2 border border-white/[0.08] flex items-center gap-2 shadow-xl">
            <svg className="w-4 h-4 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8" /><path d="M11 8v6M8 11h6" />
            </svg>
            <p className="text-xs text-slate-300 font-medium">Acercá para ver paradas</p>
          </div>
        </div>
      )}

      {/* Detalle de línea — mismo menú que Inicio→parada (recorrido, empresa, wifi). */}
      <AnimatePresence>
        {lineDetail && (
          <LineDetailSheet
            line={lineDetail.line}
            destination={lineDetail.destination}
            liveCompany={lineDetail.company}
            onClose={() => setLineDetail(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── BusLegRow ─────────────────────────────────────────────────────
// Fila del panel de ruta para un leg de bus, con ETA en vivo (FR-4.4).
function BusLegRow({
  lines, headsign, fromStopId, fromStopName, numStops, minutes, onTapStop,
}: {
  lines: string[];
  headsign: string;
  fromStopId?: string;
  fromStopName?: string;
  numStops?: number;
  minutes: number;
  onTapStop: (id: string) => void;
}) {
  const primary = lines[0] || "?";
  const { etaMin, realtime, loading } = useNextArrivalForLine(fromStopId, primary);

  // "Tomá el 64, 76 o 187" — múltiples alternativas como en Rutas.
  const linesLabel = lines.length === 0
    ? primary
    : lines.length === 1
      ? lines[0]
      : `${lines.slice(0, -1).join(", ")} o ${lines[lines.length - 1]}`;
  const dest = headsign.split(" ").slice(0, 4).join(" ");

  return (
    <button
      onClick={() => fromStopId && onTapStop(fromStopId)}
      className="w-full text-left flex items-center gap-3 py-3.5"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {(lines.length ? lines : [primary]).slice(0, 3).map((l) => (
          <LineBadge key={l} num={l} size="sm" />
        ))}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-semibold text-white truncate">
          Tomá el {linesLabel}{dest ? <span className="text-slate-400 font-normal"> · {dest}</span> : null}
        </p>
        <p className="text-xs text-slate-500 mt-0.5 truncate">
          {fromStopName} · {numStops} paradas · {minutes} min
        </p>
        {/* ETA EN VIVO */}
        {loading ? (
          <p className="text-[11px] text-slate-600 mt-1">Buscando próximo…</p>
        ) : etaMin !== null ? (
          <p className={`text-[11px] font-semibold mt-1 ${etaMin <= 3 ? "text-emerald-400" : "text-slate-300"}`}>
            {realtime ? "● " : "○ "}
            Próximo en {etaMin === 0 ? "<1" : etaMin} min{realtime ? "" : " (horario)"}
          </p>
        ) : (
          <p className="text-[11px] text-slate-600 mt-1">Sin próximos por ahora</p>
        )}
      </div>
      <svg className="w-4 h-4 text-slate-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </button>
  );
}
