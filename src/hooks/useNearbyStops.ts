"use client";

import { useState, useEffect } from "react";
import { getNearbyStopsClient } from "@/lib/utils";
import { useStopsDataset } from "@/hooks/useStopsDataset";
import type { BusStop } from "@/lib/stm";

export function useNearbyStops(lat: number | null, lon: number | null, radiusM = 600) {
  const { ready } = useStopsDataset();
  const [stops, setStops] = useState<BusStop[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (lat === null || lon === null || !ready) return;
    setLoading(true);
    const nearby = getNearbyStopsClient(lat, lon, radiusM);
    setStops(nearby);
    setLoading(false);
  }, [lat, lon, radiusM, ready]);

  return { stops, loading: loading || !ready };
}
