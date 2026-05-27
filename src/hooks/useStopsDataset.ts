"use client";

import { useState, useEffect } from "react";
import { loadStops } from "@/lib/stops-dataset";

let globalReady = false;
const listeners = new Set<() => void>();

/**
 * Hook que dispara la carga del dataset completo de paradas la primera vez
 * que se usa en la app, y devuelve `ready` cuando el cache está listo.
 * Todos los consumidores comparten el mismo cache (vía Proxy en STOPS_DATASET).
 */
export function useStopsDataset() {
  const [ready, setReady] = useState(globalReady);

  useEffect(() => {
    if (globalReady) {
      setReady(true);
      return;
    }
    listeners.add(() => setReady(true));
    loadStops().then(() => {
      globalReady = true;
      listeners.forEach((l) => l());
      listeners.clear();
    });
  }, []);

  return { ready };
}
