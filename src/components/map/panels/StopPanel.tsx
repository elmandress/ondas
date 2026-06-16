"use client";

/**
 * Bottom-sheet de la parada seleccionada en el mapa: header con distancia y
 * estado de actualización, filtro de líneas (chips) y lista de llegadas con
 * "Seguir bus". El estado (arrivals, vehículos, filtro) vive en MapScreen
 * porque también alimenta los markers del mapa; acá solo se presenta.
 */
import { useRef } from "react";
import type { Arrival, BusStop, VehiclePosition } from "@/lib/stm";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import ArrivalRow from "@/components/ui/ArrivalRow";
import EmptyState from "@/components/ui/EmptyState";
import ColdModeSuggestion from "@/components/home/ColdModeSuggestion";
import { useColdAlternatives } from "@/hooks/useColdAlternatives";
import { isInteriorStop } from "@/hooks/useInteriorArrivals";
import { Icons } from "@/components/brand/Icons";

interface Props {
  stop: BusStop;
  /** Distancia del usuario a la parada (m), null si no hay GPS real. */
  userDistanceM: number | null;
  /** Líneas REALES de la parada (API STM, no shapefile viejo). */
  realLines: string[];
  filterLine: string | null;
  onFilterLine: (line: string | null) => void;
  arrivals: Arrival[];
  arrivalsLoading: boolean;
  lastUpdated: Date | null;
  arrivalsFetchFailed: boolean;
  arrivalsOffline: boolean;
  refetch: () => void;
  /** Merge de vehículos del mapa, para ubicar el bus en vivo de cada llegada. */
  vehiclesForMap: VehiclePosition[];
  selectedVehicleId: string | null;
  /** null si el mapa todavía no está listo (no se puede volar al bus). */
  onFollowBus: ((lat: number, lon: number, vehicleId?: string) => void) | null;
  onLinePress: (line: string, destination?: string, company?: string) => void;
  onClose: () => void;
  /** Opción A (R71): la parada se abrió DESDE el Home → muestra breadcrumb "← Inicio". */
  fromHome?: boolean;
  /** Vuelve a Inicio (round-trip). Solo se usa cuando fromHome. */
  onBackToHome?: () => void;
}

export default function StopPanel({
  stop, userDistanceM, realLines, filterLine, onFilterLine,
  arrivals, arrivalsLoading, lastUpdated, arrivalsFetchFailed, arrivalsOffline, refetch,
  vehiclesForMap, selectedVehicleId, onFollowBus, onLinePress, onClose,
  fromHome, onBackToHome,
}: Props) {
  // Modo frío proactivo (mismas reglas que StopArrivalSheet): espera >15 min o sin
  // servicio → alternativas alcanzables a pasos con ETA en vivo.
  const coldActive = !isInteriorStop(stop.stopId) && !arrivalsOffline && !arrivalsFetchFailed && lastUpdated !== null;
  const coldSuggestions = useColdAlternatives(
    stop,
    arrivals.length > 0 ? arrivals[0].eta : null,
    realLines,
    coldActive,
  );

  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef); // R70: la hoja de parada del mapa atrapa el foco (peer/drill con la ficha-bus)

  return (
    <div ref={panelRef} role="dialog" aria-modal="true" aria-label={`Parada ${stop.stopName}`} className="map-stop-panel absolute bottom-0 left-0 right-0 z-[1001]">
      <div className="map-stop-panel-inner bg-[#0E1116]/[0.97] backdrop-blur-xl border-t border-white/[0.07] rounded-t-[18px] overflow-hidden" style={{ boxShadow: "var(--shadow-sheet)" }}>
        <div className="map-panel-handle flex justify-center pt-2.5 pb-1.5">
          <div className="w-9 h-[3px] rounded-full bg-white/15" />
        </div>

        {/* Opción A (R71): viniste del Home → breadcrumb de retorno. Comunica "te traje a
            ver esto en el mapa" y da el camino de vuelta a Inicio (= back semántico). */}
        {fromHome && onBackToHome && (
          <button onClick={onBackToHome} className="stop-panel-breadcrumb" aria-label="Volver a Inicio">
            <span style={{ transform: "rotate(180deg)", display: "grid" }}><Icons.Chevron size={14} /></span>
            Inicio
          </button>
        )}

        <div className="px-4 pb-2 flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="eyebrow accent">Parada #{stop.stopCode}</p>
            <p className="text-[16px] font-bold text-white leading-tight mt-1 truncate">{stop.stopName}</p>
            <p className="text-xs text-slate-500 mt-1">
              {userDistanceM != null && <>{userDistanceM}m · </>}
              {realLines.length || "—"} {realLines.length === 1 ? "línea" : "líneas"}
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
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white/[0.06] flex items-center justify-center flex-shrink-0" aria-label="Cerrar">
            <svg className="w-3.5 h-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Filtro de líneas DENTRO de la hoja (antes flotaba sobre el mapa) */}
        {realLines.length > 1 && (
          <div className="px-4 pb-2.5 flex gap-1.5 overflow-x-auto scrollbar-none">
            <button
              onClick={() => onFilterLine(null)}
              className="flex-shrink-0 px-3 h-8 rounded-lg text-[12px] font-bold flex items-center"
              style={!filterLine ? { background: "var(--accent-bg)", color: "#1a1206" } : { background: "var(--surface)", color: "var(--text-2)", border: "1px solid var(--border-strong)" }}
            >
              Todas
            </button>
            {realLines.slice(0, 16).map((l) => {
              const on = filterLine === l;
              return (
                <button
                  key={l}
                  onClick={() => onFilterLine(on ? null : l)}
                  className="flex-shrink-0 px-3 h-8 rounded-lg text-[12px] font-bold flex items-center"
                  style={on ? { background: "var(--accent-bg)", color: "#1a1206" } : { background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border-strong)" }}
                >
                  {l}
                </button>
              );
            })}
          </div>
        )}

        {/* Live region (PG-4): anuncia al lector de pantalla el próximo bus cuando los
            datos cambian (polite + una sola línea = no satura con el refresh de 15s). */}
        {arrivals.length > 0 && (
          <p className="sr-only" role="status">
            Próximo bus: línea {arrivals[0].lineName} hacia {arrivals[0].destination},{" "}
            {!Number.isFinite(arrivals[0].eta) || arrivals[0].eta <= 0 ? "llegando ahora" : `en ${Math.round(arrivals[0].eta)} minutos`}
          </p>
        )}
        <div className="map-panel-scroll px-4 max-h-[44vh] overflow-y-auto"
             style={{ paddingBottom: "calc(20px + env(safe-area-inset-bottom))" }}>
          <ColdModeSuggestion suggestions={coldSuggestions} />
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
              const canFollow = a.realtime && typeof followLat === "number" && typeof followLon === "number" && !!onFollowBus;
              return (
                <ArrivalRow
                  // R58d: key SIN eta (cambia cada refresh → remontaba todas las filas
                  // y la animación de entrada parpadeaba cada 15-20s).
                  key={a.vehicleId ? `v${a.vehicleId}` : `s-${a.lineId}-${i}`}
                  arrival={a}
                  stopId={stop.stopId}
                  onLinePress={onLinePress}
                  following={!!a.vehicleId && selectedVehicleId === a.vehicleId}
                  onFollow={canFollow ? () => onFollowBus!(followLat!, followLon!, a.vehicleId) : undefined}
                />
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
