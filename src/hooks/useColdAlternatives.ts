"use client";

/**
 * Modo frío (proactivo): cuando la espera en la parada actual es larga (>15 min o sin
 * servicio), consulta las llegadas EN VIVO de hasta 3 paradas a ≤300 m y devuelve las
 * alternativas alcanzables caminando que salen antes. Lógica de selección en
 * lib/cold-mode.ts (pura, testeada); acá solo el fetch + ciclo de vida.
 *
 * Cuidado con la carga: solo consulta cuando el modo frío está ACTIVO, cachea por
 * parada 60 s a nivel módulo (si abrís/cerrás el sheet no re-pega a la API) y refresca
 * cada 60 s mientras siga frío — no cada 15-20 s como las llegadas principales.
 */
import { useState, useEffect } from "react";
import type { Arrival, BusStop } from "@/lib/stm";
import { getNearbyStopsClient, distanceTo } from "@/lib/utils";
import { isColdWait, pickColdAlternatives, type ColdSuggestion, type AltStopInput } from "@/lib/cold-mode";

const NEARBY_RADIUS_M = 300;
const MAX_ALT_STOPS = 3;
const REFRESH_MS = 60_000;
const CACHE_TTL_MS = 60_000;

const altCache = new Map<string, { ts: number; alts: AltStopInput[] }>();

async function fetchAltStops(stop: BusStop, signal: AbortSignal): Promise<AltStopInput[]> {
  const cached = altCache.get(stop.stopId);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.alts;

  const nearby = getNearbyStopsClient(stop.stopLat, stop.stopLon, NEARBY_RADIUS_M, MAX_ALT_STOPS + 1)
    .filter((s) => s.stopId !== stop.stopId)
    .slice(0, MAX_ALT_STOPS);
  if (nearby.length === 0) return [];

  const alts = await Promise.all(
    nearby.map(async (s): Promise<AltStopInput> => {
      let arrivals: Arrival[] = [];
      try {
        const res = await fetch(`/api/stm/arrivals?stopId=${encodeURIComponent(s.stopId)}`, { signal });
        if (res.ok) arrivals = ((await res.json()).arrivals || []) as Arrival[];
      } catch { /* parada vecina sin datos → se ignora */ }
      return {
        stopId: s.stopId,
        stopName: s.stopName,
        distM: distanceTo(stop.stopLat, stop.stopLon, s.stopLat, s.stopLon),
        arrivals: arrivals.map((a) => ({
          line: a.lineName,
          destination: a.destination,
          etaMin: a.eta,
          isScheduled: !!a.isScheduled,
        })),
      };
    }),
  );

  altCache.set(stop.stopId, { ts: Date.now(), alts });
  return alts;
}

/**
 * @param stop        Parada actual (undefined hasta que cargue el dataset).
 * @param hereEtaMin  ETA del primer bus acá (min); null = sin llegadas.
 * @param hereLines   Líneas de la parada actual (para excluirlas de las sugerencias).
 * @param active      Condición externa: datos frescos, online, no interior. El hook
 *                    además exige que la espera sea fría (lib/cold-mode).
 */
export function useColdAlternatives(
  stop: BusStop | undefined,
  hereEtaMin: number | null,
  hereLines: string[],
  active: boolean,
): ColdSuggestion[] {
  // Estado keyado por parada: al cambiar de parada o salir del modo frío no hay que
  // "limpiar" con setState síncrono en el efecto (anti-patrón) — el return deriva [].
  const [result, setResult] = useState<{ stopId: string; list: ColdSuggestion[] }>({ stopId: "", list: [] });
  // hereLines cambia de identidad en cada render del padre → clave estable para deps.
  const linesKey = hereLines.join(",");
  const cold = active && !!stop && isColdWait(hereEtaMin);

  useEffect(() => {
    if (!cold || !stop) return;

    const ctrl = new AbortController();
    let cancelled = false;

    const run = async () => {
      const alts = await fetchAltStops(stop, ctrl.signal);
      if (cancelled) return;
      setResult({ stopId: stop.stopId, list: pickColdAlternatives(hereEtaMin, linesKey.split(",").filter(Boolean), alts) });
    };

    run();
    const timer = setInterval(run, REFRESH_MS);
    return () => {
      cancelled = true;
      ctrl.abort();
      clearInterval(timer);
    };
  }, [cold, stop, hereEtaMin, linesKey]);

  return cold && stop && result.stopId === stop.stopId ? result.list : [];
}
