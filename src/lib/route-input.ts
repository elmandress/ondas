/**
 * Store global para pre-cargar origen/destino en RouteScreen.
 * Lo usa el long-press del mapa para mandar al usuario a "Cómo Llegar"
 * con el punto ya cargado.
 *
 * SRS FR-4.1.
 */
import { useSyncExternalStore } from "react";

export interface RoutePoint { lat: number; lon: number; name?: string }

export interface RouteInputState {
  /** Modo single-slot (long-press del mapa): pre-carga origen O destino. */
  slot?: "from" | "to";
  point?: RoutePoint;
  /**
   * Modo ruta completa (abrir una ruta guardada de "Mis rutas"): pre-carga ambos.
   * Si `fromCurrentLocation` es true, el origen se toma del GPS al abrir.
   */
  from?: RoutePoint;
  to?: RoutePoint;
  fromCurrentLocation?: boolean;
}

let _state: RouteInputState | null = null;
const listeners = new Set<() => void>();

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function getSnapshot() { return _state; }
function getServerSnapshot() { return null; }

export function setRouteInput(s: RouteInputState | null) {
  _state = s;
  listeners.forEach((fn) => fn());
}
export function useRouteInput(): RouteInputState | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
