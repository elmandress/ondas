"use client";

import { useState, useEffect, useCallback } from "react";

export interface Location {
  lat: number;
  lon: number;
  accuracy: number;
  /** true si vino del GPS real; false si es fallback (centro de Montevideo) */
  isReal: boolean;
}

export type LocationStatus = "pending" | "ok" | "denied" | "unavailable" | "timeout";

const MVD_CENTER = { lat: -34.9058, lon: -56.1882, accuracy: 5000 };

export function useLocation() {
  const [location, setLocation] = useState<Location | null>(null);
  const [status, setStatus] = useState<LocationStatus>("pending");

  const request = useCallback(() => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setLocation({ ...MVD_CENTER, isReal: false });
      setStatus("unavailable");
      return;
    }

    setStatus("pending");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          isReal: true,
        });
        setStatus("ok");
      },
      (err) => {
        // Mostramos el centro como fallback PERO marcado como isReal=false
        // para que la UI no muestre distancias mentirosas.
        setLocation({ ...MVD_CENTER, isReal: false });
        if (err.code === err.PERMISSION_DENIED) setStatus("denied");
        else if (err.code === err.TIMEOUT) setStatus("timeout");
        else setStatus("unavailable");
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  }, []);

  useEffect(() => {
    request();
  }, [request]);

  return {
    location,
    loading: status === "pending",
    status,
    error: status === "denied" ? "Permiso de ubicación denegado"
         : status === "timeout" ? "GPS demoró demasiado"
         : status === "unavailable" ? "GPS no disponible"
         : null,
    /** Reintentar solicitar permiso/ubicación */
    retry: request,
    /** true si la ubicación viene del GPS y es confiable */
    isReal: location?.isReal ?? false,
  };
}
