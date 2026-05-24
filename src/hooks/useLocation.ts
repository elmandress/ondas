"use client";

import { useState, useEffect } from "react";

interface Location {
  lat: number;
  lon: number;
  accuracy: number;
}

export function useLocation() {
  const [location, setLocation] = useState<Location | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      // Fallback a centro de Montevideo
      setLocation({ lat: -34.9058, lon: -56.1882, accuracy: 1000 });
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setLoading(false);
      },
      () => {
        // Si el usuario niega permisos, usar centro de MVD
        setLocation({ lat: -34.9058, lon: -56.1882, accuracy: 1000 });
        setLoading(false);
        setError("Usando ubicación por defecto — Montevideo Centro");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  return { location, loading, error };
}
