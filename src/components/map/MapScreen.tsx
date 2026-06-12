"use client";

/**
 * Pestaña Mapa — ORQUESTADOR. Mantiene el estado interconectado (parada,
 * vehículo seguido, filtro de línea, ruta/lugar globales, pin de long-press)
 * y la lógica de merge de fuentes en vivo; la UI de cada panel vive en
 * ./panels/* (StopPanel, RoutePanel, PlacePanel, VehicleCard, PinDropPopup).
 *
 * Los paneles son mutuamente excluyentes — el AnimatePresence de cada uno
 * acá es la clave de esa coordinación. No mover esa lógica a los hijos.
 */
import dynamic from "next/dynamic";
import { useState, useEffect, useMemo, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import { useVehicles } from "@/hooks/useVehicles";
import { useInteriorBuses } from "@/hooks/useInteriorBuses";
import { useLocation } from "@/hooks/useLocation";
import { useArrivals } from "@/hooks/useArrivals";
import { useStopsDataset } from "@/hooks/useStopsDataset";
import { useStopInfo } from "@/hooks/useStopInfo";
import { useBackClose } from "@/hooks/useBackClose";
import { STOPS_DATASET, type BusStop, type VehiclePosition } from "@/lib/stm";
import { getStopsInBoundsClient, distanceTo } from "@/lib/utils";
import { loadRoutesCache, loadLineShapes, type RoutesIndex } from "@/lib/routes-cache";
import { filterUpstreamBuses } from "@/lib/bus-direction";
import { useSelectedPlace, setSelectedPlace } from "@/lib/selected-place";
import { useSelectedRoute, setSelectedRoute } from "@/lib/selected-route";
import { useEnrichedRouteLegs } from "@/hooks/useEnrichedRouteLegs";
import { speak } from "@/lib/voice-alerts";
import { haptic } from "@/lib/haptics";
import LineDetailSheet from "@/components/home/LineDetailSheet";
import StopPanel from "@/components/map/panels/StopPanel";
import RoutePanel from "@/components/map/panels/RoutePanel";
import PlacePanel from "@/components/map/panels/PlacePanel";
import VehicleCard from "@/components/map/panels/VehicleCard";
import PinDropPopup from "@/components/map/panels/PinDropPopup";

const LeafletMap = dynamic(() => import("@/components/map/LeafletMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-[#070b14] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm">Abriendo el mapa…</p>
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
  const [lineShapesIdx, setLineShapesIdx] = useState<Record<string, string[]> | null>(null);
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
  // line-shapes.json (chico) viaja junto: el filtro upstream lo usa para saber si
  // una línea tiene shapes sin colisionar con cod_variantes (R57).
  useEffect(() => {
    if (!selectedStopId || routesIdx) return;
    let cancelled = false;
    Promise.all([loadRoutesCache(), loadLineShapes()]).then(([r, ls]) => {
      if (!cancelled) { setLineShapesIdx(ls); setRoutesIdx(r); }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        list = filterUpstreamBuses(list, selectedStop.stopLat, selectedStop.stopLon, routesIdx, lineShapesIdx ?? undefined);
      }
    }

    // Re-agregar el bus seleccionado si fue descartado por algún filtro
    if (selectedVehicleId && !list.find((v) => v.vehicleId === selectedVehicleId)) {
      const sv = vehicles.find((v) => v.vehicleId === selectedVehicleId);
      if (sv) list = [...list, sv];
    }
    return list;
  }, [vehicles, filterLine, selectedStop, selectedVehicleId, routesIdx, lineShapesIdx]);

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

  // FIX MAP-2: arrivals y vehicles refrescan en momentos distintos → el bus elegido
  // puede desaparecer del merge por un ciclo (GPS stale, fuente que no lo trajo) y
  // la card moría ("toco el bus y no carga"). Retenemos la última posición conocida
  // mientras el seguimiento siga activo; cuando vuelve el dato fresco, se actualiza.
  const liveVehicle = selectedVehicleId
    ? vehiclesForMap.find((v) => v.vehicleId === selectedVehicleId)
    : undefined;
  const [lastVehicle, setLastVehicle] = useState<VehiclePosition | null>(null);
  useEffect(() => {
    if (liveVehicle) setLastVehicle(liveVehicle);
    else if (!selectedVehicleId) setLastVehicle(null);
  }, [liveVehicle, selectedVehicleId]);
  const selectedVehicle: VehiclePosition | undefined =
    liveVehicle ?? (lastVehicle && lastVehicle.vehicleId === selectedVehicleId ? lastVehicle : undefined);

  // Seguimiento del bus elegido hacia la parada: ETA + paradas restantes (dato GTFS).
  // La cuenta regresiva de paradas ("faltan 3 paradas") es la feature estrella de
  // Transit GO / Citymapper / Moovit — la gente la quiere más que los minutos.
  const followed = useMemo(() => {
    if (!selectedVehicleId || !selectedStop) return null;
    const a = arrivals.find((x) => x.vehicleId === selectedVehicleId && x.realtime);
    if (!a) return null;
    return { eta: a.eta, remainingStops: a.remainingStops ?? null };
  }, [selectedVehicleId, selectedStop, arrivals]);
  const followedEta = followed?.eta ?? null;
  const followedStops = followed?.remainingStops ?? null;
  // Disparamos por paradas restantes si lo tenemos (más preciso que el ETA); si no, por ETA.
  const followAlert: "now" | "soon" | null =
    followedStops != null
      ? (followedStops <= 0 ? "now" : followedStops <= 2 ? "soon" : null)
      : followedEta != null && followedEta <= 3
        ? (followedEta <= 1 ? "now" : "soon")
        : null;

  // Aviso por VOZ del "preparate / bajate" — accesibilidad y manos libres (opt-in en
  // Ajustes). Solo habla cuando el estado CAMBIA (ref), para no repetir cada refresh.
  const lastSpokenAlert = useRef<"now" | "soon" | null>(null);
  useEffect(() => {
    if (followAlert === lastSpokenAlert.current) return;
    lastSpokenAlert.current = followAlert;
    const stopsTxt = followedStops != null && followedStops > 0 ? ` Faltan ${followedStops} paradas.` : "";
    if (followAlert === "soon") { haptic(15); speak(`Preparate, tu bus está por llegar a tu parada.${stopsTxt}`); }
    else if (followAlert === "now") { haptic([20, 60, 20]); speak("¡Bajate ahora! Tu bus está llegando a tu parada."); }
  }, [followAlert, followedStops]);

  function clearSelections() {
    setSelectedStopId(null);
    setSelectedVehicleId(null);
    setFilterLine(null);
    setSelectedPlace(null);
    setSelectedRoute(null);
  }

  // Atrás del sistema cierra el panel abierto del mapa, no la app (R58c).
  // Un back limpia toda la selección (predecible; los paneles son una "vista").
  const anyPanelOpen = !!(selectedStopId || selectedVehicleId || selectedPlace || selectedRoute || pinDrop);
  useBackClose(() => { setPinDrop(null); clearSelections(); }, anyPanelOpen);

  function selectStop(id: string) {
    setSelectedStopId(id);
    setSelectedVehicleId(null);
    setFilterLine(null);
  }

  const userDistanceM = selectedStop && location && locationIsReal
    ? distanceTo(location.lat, location.lon, selectedStop.stopLat, selectedStop.stopLon)
    : null;

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
                  <p className="text-[11px] text-amber-400 font-bold leading-none">Ruta</p>
                  <p className="text-xs text-white font-semibold truncate leading-tight mt-0.5">
                    {selectedRoute.origin.name || "Origen"} → {selectedRoute.destination.name || "Destino"}
                  </p>
                </>
              ) : selectedPlace ? (
                <>
                  <p className="text-[11px] text-red-400 font-bold leading-none">Lugar</p>
                  <p className="text-xs text-white font-semibold truncate leading-tight mt-0.5">{selectedPlace.name}</p>
                </>
              ) : (
                <>
                  <p className="text-[13px] text-white font-bold leading-tight">
                    {!stopsReady
                      ? "Cargando paradas…"
                      : visibleStops.length > 0
                      ? `${visibleStops.length} paradas a la vista`
                      : bounds && bounds.zoom < 14
                      ? "Acercá el mapa para ver paradas"
                      : "Buscando paradas…"}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Tocá una parada para ver sus buses</p>
                </>
              )}
            </div>
            {(selectedRoute || selectedPlace) && (
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
          onStopSelect={selectStop}
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
          <StopPanel
            stop={selectedStop}
            userDistanceM={userDistanceM}
            realLines={realLines}
            filterLine={filterLine}
            onFilterLine={setFilterLine}
            arrivals={arrivals}
            arrivalsLoading={arrivalsLoading}
            lastUpdated={lastUpdated}
            arrivalsFetchFailed={arrivalsFetchFailed}
            arrivalsOffline={arrivalsOffline}
            refetch={refetch}
            vehiclesForMap={vehiclesForMap}
            selectedVehicleId={selectedVehicleId}
            onFollowBus={mapApi ? (lat, lon, vehicleId) => {
              haptic(); // confirmación táctil sutil (premium, sin ruido visual)
              mapApi.flyTo(lat, lon, 17);
              if (vehicleId) setSelectedVehicleId(vehicleId);
            } : null}
            onLinePress={(line, destination, company) => setLineDetail({ line, destination, company })}
            onClose={clearSelections}
          />
        )}
      </AnimatePresence>

      {/* ── PANEL DE RUTA PLANIFICADA (FR-4) ── */}
      <AnimatePresence>
        {selectedRoute && !selectedStop && (
          <RoutePanel
            selectedRoute={selectedRoute}
            onClose={() => setSelectedRoute(null)}
            onTapStop={(id) => setSelectedStopId(id)}
          />
        )}
      </AnimatePresence>

      {/* ── PANEL DE LUGAR BUSCADO (FR-3.8) ── */}
      <AnimatePresence>
        {selectedPlace && !selectedStop && !selectedRoute && (
          <PlacePanel
            place={selectedPlace}
            stopsReady={stopsReady}
            onClose={() => setSelectedPlace(null)}
            onSelectStop={selectStop}
          />
        )}
      </AnimatePresence>

      {/* ── INFO VEHÍCULO SELECCIONADO (sobre el panel de parada si hay) ── */}
      <AnimatePresence>
        {selectedVehicle && (
          <VehicleCard
            vehicle={selectedVehicle}
            followAlert={followAlert}
            followedStops={followedStops}
            followedEta={followedEta}
            abovePanel={!!selectedStop}
            onOpenLineDetail={(line, destination, company) => setLineDetail({ line, destination, company })}
            onClose={() => setSelectedVehicleId(null)}
          />
        )}
      </AnimatePresence>

      {/* ── POPUP LONG-PRESS (FR-4.1): elegir punto como origen/destino ── */}
      <AnimatePresence>
        {pinDrop && (
          <PinDropPopup pin={pinDrop} pinName={pinName} onClose={() => setPinDrop(null)} />
        )}
      </AnimatePresence>

      {/* Botón flotante: centrar en mi ubicación. R58b: estaba en bottom 24px — la MISMA
          esquina que el control de zoom de Leaflet, que lo tapaba (el usuario nunca lo
          veía). Ahora vive arriba del zoom (+/− ocupa ~90px + márgenes). */}
      {location && locationIsReal && (
        <button
          onClick={() => { haptic(8); mapApi?.flyTo(location.lat, location.lon, 16); }}
          className="absolute right-4 z-[1000] w-12 h-12 rounded-full bg-[#101626]/95 backdrop-blur-xl border border-white/[0.08] flex items-center justify-center shadow-xl active:scale-95 transition-transform"
          style={{ bottom: selectedStop ? "calc(48vh + 16px)" : "152px" }}
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
