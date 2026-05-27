/**
 * Store global para pre-cargar origen/destino en RouteScreen.
 * Lo usa el long-press del mapa para mandar al usuario a "Cómo Llegar"
 * con el punto ya cargado.
 *
 * SRS FR-4.1.
 */
import { useSyncExternalStore } from "react";

export interface RouteInputState {
  /** Tipo de input que se está pre-cargando: origen o destino */
  slot: "from" | "to";
  point: { lat: number; lon: number; name?: string };
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
