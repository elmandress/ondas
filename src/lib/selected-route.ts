/**
 * Store global para "ruta seleccionada en Cómo Llegar".
 * Cuando el usuario toca una opción de viaje en RouteScreen, se setea acá.
 * MapScreen la detecta para dibujar polylines + auto-fit del mapa.
 *
 * SRS FR-4: visualización en mapa de la ruta planificada.
 */
import { useSyncExternalStore } from "react";
import type { PlannedRouteDto } from "@/hooks/useRouteplanner";

export interface SelectedRouteState {
  route: PlannedRouteDto;
  /** Coords originales del origen/destino (para los puntos en el mapa). */
  origin: { lat: number; lon: number; name?: string };
  destination: { lat: number; lon: number; name?: string };
}

let _state: SelectedRouteState | null = null;
const listeners = new Set<() => void>();

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function getSnapshot() { return _state; }
function getServerSnapshot() { return null; }

export function setSelectedRoute(s: SelectedRouteState | null) {
  _state = s;
  listeners.forEach((fn) => fn());
}
export function getSelectedRoute(): SelectedRouteState | null {
  return _state;
}
export function useSelectedRoute(): SelectedRouteState | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
