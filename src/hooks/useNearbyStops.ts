"use client";

import { useMemo } from "react";
import { getNearbyStopsClient } from "@/lib/utils";
import { useStopsDataset } from "@/hooks/useStopsDataset";
import type { BusStop } from "@/lib/stm";

export function useNearbyStops(lat: number | null, lon: number | null, radiusM = 600) {
  const { ready } = useStopsDataset();

  // Derivación pura del dataset (ya cargado en memoria) — useMemo, no effect:
  // evita un render extra y el setState-en-effect que marca react-hooks.
  const stops = useMemo<BusStop[]>(() => {
    if (lat === null || lon === null || !ready) return [];
    return getNearbyStopsClient(lat, lon, radiusM);
  }, [lat, lon, radiusM, ready]);

  return { stops, loading: !ready };
}
