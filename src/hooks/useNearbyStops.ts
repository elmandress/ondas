"use client";

import { useState, useEffect } from "react";
import type { BusStop } from "@/lib/stm";

export function useNearbyStops(lat: number | null, lon: number | null) {
  const [stops, setStops] = useState<BusStop[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!lat || !lon) return;
    setLoading(true);
    fetch(`/api/stm/stops?lat=${lat}&lon=${lon}`)
      .then((r) => r.json())
      .then((data) => setStops(data.stops || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [lat, lon]);

  return { stops, loading };
}
