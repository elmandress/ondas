"use client";

import { useState, useEffect } from "react";

export interface LineStop {
  stopId: string;
  sequence: number;
  arrivalSeconds: number;
  name: string;
  code: string;
  lat: number;
  lon: number;
}

export interface LineStopsResult {
  line: string;
  headsign: string;
  variantId: string;
  stops: LineStop[];
  loading: boolean;
  notFound: boolean;
}

const cache = new Map<string, LineStop[]>();

export function useLineStops(line: string | null, destination = ""): LineStopsResult {
  const [stops, setStops] = useState<LineStop[]>([]);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [headsign, setHeadsign] = useState("");
  const [variantId, setVariantId] = useState("");

  useEffect(() => {
    if (!line) { setStops([]); return; }
    const key = `${line}|${destination}`;
    if (cache.has(key)) { setStops(cache.get(key)!); return; }

    let cancelled = false;
    setLoading(true);
    setNotFound(false);

    const params = new URLSearchParams({ line });
    if (destination) params.set("destination", destination);

    fetch(`/api/stm/variant-stops?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.notFound || !data.stops?.length) {
          setNotFound(true);
          setStops([]);
        } else {
          cache.set(key, data.stops);
          setStops(data.stops);
          setHeadsign(data.headsign || "");
          setVariantId(data.variantId || "");
        }
      })
      .catch(() => { if (!cancelled) setNotFound(true); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [line, destination]);

  return { line: line ?? "", headsign, variantId, stops, loading, notFound };
}
