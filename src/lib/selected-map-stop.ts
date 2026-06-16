/**
 * Store global "abrir esta parada en el Mapa" (R71, Opción A).
 *
 * Cuando tocás una parada desde el Home, en vez de abrir el StopArrivalSheet (lista sola
 * que tapa la pantalla) seteamos acá la parada + un flag `fromHome`, y cambiamos al tab
 * Mapa. MapScreen lo consume → selecciona la parada (vuela + abre StopPanel + muestra TODOS
 * los buses que la sirven, todo lo que ya hace hoy). El flag `fromHome` controla el back
 * semántico: si viniste del Home, el "atrás" / breadcrumb te devuelven a Inicio; si abriste
 * la parada explorando el mapa, el back se comporta como siempre (cierra el panel).
 *
 * Mismo patrón pub/sub con useSyncExternalStore que selected-place / selected-route.
 * `gen` se incrementa en cada set → la MISMA parada pedida dos veces seguidas igual
 * dispara el efecto en MapScreen (referencia distinta no alcanza si el id no cambia).
 */
import { useSyncExternalStore } from "react";

export interface MapStopRequest {
  stopId: string;
  /** true = la pidió el Home (back → vuelve a Inicio). false = abierta explorando el mapa. */
  fromHome: boolean;
  /** Token incremental: garantiza que pedir la misma parada otra vez vuelva a disparar. */
  gen: number;
}

let _req: MapStopRequest | null = null;
let _gen = 0;
const listeners = new Set<() => void>();

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function getSnapshot() { return _req; }
function getServerSnapshot() { return null; }

/** El Home pide abrir una parada en el Mapa. MapScreen la consume y la limpia. */
export function requestMapStop(stopId: string, fromHome = true) {
  _req = { stopId, fromHome, gen: ++_gen };
  listeners.forEach((fn) => fn());
}

/** MapScreen limpia el pedido una vez consumido (evita re-selección en re-render). */
export function clearMapStopRequest() {
  if (_req === null) return;
  _req = null;
  listeners.forEach((fn) => fn());
}

export function useMapStopRequest(): MapStopRequest | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
