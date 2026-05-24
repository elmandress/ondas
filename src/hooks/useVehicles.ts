"use client";

import { useState, useEffect } from "react";
import type { VehiclePosition } from "@/lib/stm";

export function useVehicles(intervalMs = 8000) {
  const [vehicles, setVehicles] = useState<VehiclePosition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = () =>
      fetch("/api/stm/vehicles")
        .then((r) => r.json())
        .then((d) => setVehicles(d.vehicles || []))
        .catch(() => {})
        .finally(() => setLoading(false));

    load();
    const id = setInterval(load, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return { vehicles, loading };
}
