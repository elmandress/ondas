/**
 * Store global del tab activo de la nav inferior.
 * Permite que cualquier componente pueda navegar a otro tab sin prop drilling.
 */
import { useSyncExternalStore } from "react";

export type Tab = "home" | "route" | "map" | "search";

let _tab: Tab = "home";
const listeners = new Set<() => void>();

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function getSnapshot() { return _tab; }
function getServerSnapshot(): Tab { return "home"; }

export function setActiveTab(tab: Tab) {
  if (_tab === tab) return;
  _tab = tab;
  listeners.forEach((fn) => fn());
}

export function getActiveTab(): Tab { return _tab; }

export function useActiveTab(): [Tab, (t: Tab) => void] {
  const tab = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return [tab, setActiveTab];
}
