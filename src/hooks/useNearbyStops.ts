"use client";

import { useState, useEffect } from "react";
import { getNearbyStopsClient } from "@/lib/utils";
import type { BusStop } from "@/lib/stm";

export function useNearbyStops(lat: number | null, lon: number | null, radiusM = 600) {
  const [stops, setStops] = useState<BusStop[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (lat === null || lon === null) return;
    setLoading(true);
    // Búsqueda local del lado cliente — sin fetch
    const nearby = getNearbyStopsClient(lat, lon, radiusM);
    setStops(nearby);
    setLoading(false);
  }, [lat, lon, radiusM]);

  return { stops, loading };
}
