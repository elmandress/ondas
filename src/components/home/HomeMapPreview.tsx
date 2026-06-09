"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { useLocation } from "@/hooks/useLocation";
import { useStopsDataset } from "@/hooks/useStopsDataset";
import { useVehicles } from "@/hooks/useVehicles";
import { getNearbyStopsClient } from "@/lib/utils";
import { haversineMeters } from "@/lib/geo";
import { Icons } from "@/components/brand/Icons";
import { haptic } from "@/lib/haptics";

const LeafletMap = dynamic(() => import("@/components/map/LeafletMap"), {
  ssr: false,
  loading: () => <div className="hmp-skel skel" aria-label="Cargando mapa" />,
});

/**
 * Preview del mapa en la Home: apenas abrís, ves TU zona — tu ubicación, las paradas de
 * al lado y los buses que vienen. Un mapa se entiende más rápido que una lista (sobre todo
 * gente que no usa apps). Tocar cualquier parte abre el mapa completo.
 *
 * Liviano: Leaflet carga lazy; los buses son los de las líneas de tus paradas cercanas
 * (no todos), con polling espaciado; un overlay capta el tap (no se arrastra acá, para que
 * el gesto sea "abrir", no "explorar").
 */
export default function HomeMapPreview({ onOpen }: { onOpen: () => void }) {
  const { location, isReal } = useLocation();
  const { ready } = useStopsDataset();

  const stops = useMemo(
    () => (location && ready ? getNearbyStopsClient(location.lat, location.lon, 800, 14) : []),
    [location, ready]
  );

  // Buses de las líneas de las paradas más cercanas (acotado para no saturar la red).
  const nearbyLines = useMemo(() => {
    const set = new Set<string>();
    for (const s of stops.slice(0, 4)) for (const l of s.lines) set.add(l);
    return [...set].slice(0, 12);
  }, [stops]);

  const { vehicles } = useVehicles(20000, { enabled: nearbyLines.length > 0, lineIds: nearbyLines });

  // Solo los buses de TU ZONA (≤2 km): el hook trae todos los de esas líneas en la ciudad,
  // pero "153 buses" sería mentir. Filtramos a los que de verdad tenés cerca.
  const nearbyVehicles = useMemo(
    () => (location ? vehicles.filter((v) => haversineMeters(location.lat, location.lon, v.lat, v.lon) <= 2000) : []),
    [vehicles, location]
  );

  // Sin ubicación todavía → no ocupamos espacio (la Home ya tiene su CTA de ubicación).
  if (!location) return null;

  const open = () => { haptic(8); onOpen(); };

  return (
    <button className="home-map-preview" onClick={open} aria-label="Abrir mapa completo">
      <LeafletMap
        center={[location.lat, location.lon]}
        stops={stops}
        vehicles={nearbyVehicles}
        selectedStopId={null}
        selectedVehicleId={null}
        onStopSelect={open}
        onVehicleSelect={() => {}}
        onMapClick={open}
      />
      {/* Capa que capta el tap y da el degradado + hint (encima del mapa) */}
      <span className="hmp-overlay" aria-hidden>
        <span className="hmp-chip">
          <span className="hmp-dot" />
          {isReal ? "Tu zona ahora" : "Zona aproximada"}
          {nearbyVehicles.length > 0 && <> · {nearbyVehicles.length} {nearbyVehicles.length === 1 ? "bus cerca" : "buses cerca"}</>}
        </span>
        <span className="hmp-cta">
          Ver mapa completo <Icons.Chevron size={14} />
        </span>
      </span>
    </button>
  );
}
