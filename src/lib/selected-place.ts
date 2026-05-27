/**
 * Store global para "lugar seleccionado" (FR-3.8).
 * Cuando el usuario toca un lugar en el buscador, se setea acá y el MapScreen
 * lo detecta para pinearlo + mostrar paradas/buses cercanos.
 *
 * Implementación simple sin libs externas: pub/sub con useSyncExternalStore.
 */

import { useSyncExternalStore } from "react";

export interface SelectedPlace {
  id: string | number;
  name: string;
  fullName?: string;
  lat: number;
  lon: number;
  icon?: string;
  category?: string;
}

let _place: SelectedPlace | null = null;
const listeners = new Set<() => void>();

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function getSnapshot() {
  return _place;
}

function getServerSnapshot() {
  return null;
}

export function setSelectedPlace(place: SelectedPlace | null) {
  _place = place;
  listeners.forEach((fn) => fn());
}

export function getSelectedPlace(): SelectedPlace | null {
  return _place;
}

export function useSelectedPlace(): SelectedPlace | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
