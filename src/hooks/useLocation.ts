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

// Distancia en metros entre dos coords (haversine).
function distM(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

// Umbral de movimiento real: watchPosition emite muchísimos updates con micro-drift
// del GPS aunque estés quieto. Si propagáramos cada uno, la home recalcula la parada
// más cercana y el contador "salí en X" parpadea (trackea/destrackea sin parar). Solo
// actualizamos si te moviste > este umbral → ubicación estable, UI sin temblar.
const MOVE_THRESHOLD_M = 25;

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
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setLocation({ ...MVD_CENTER, isReal: false });
      setStatus("unavailable");
      return;
    }

    setStatus("pending");

    // Última posición YA propagada al estado, para filtrar micro-drift.
    let lastLat: number | null = null;
    let lastLon: number | null = null;
    let lastAcc = Infinity;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lon, accuracy } = pos.coords;
        // Propagar solo si: es la primera fix, te moviste > umbral, o la precisión
        // mejoró bastante (pasaste de un fix malo a uno bueno). Si no, ignorar el
        // update → el estado no cambia → la UI no re-renderiza ni tiembla.
        const moved = lastLat === null || distM(lastLat, lastLon!, lat, lon) > MOVE_THRESHOLD_M;
        const muchBetterAccuracy = accuracy < lastAcc - 20;
        setStatus("ok");
        if (!moved && !muchBetterAccuracy) return;
        lastLat = lat; lastLon = lon; lastAcc = accuracy;
        setLocation({ lat, lon, accuracy, isReal: true });
      },
      (err) => {
        setLocation({ ...MVD_CENTER, isReal: false });
        if (err.code === err.PERMISSION_DENIED) setStatus("denied");
        else if (err.code === err.TIMEOUT) setStatus("timeout");
        else setStatus("unavailable");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

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
