/**
 * Hook lazy para el "pager" de horarios programados (idea estilo maprab):
 * dado (stopId, lineName) devuelve las próximas N llegadas PROGRAMADAS de esa
 * línea en esa parada, para que el usuario pueda recorrerlas con ‹ ›.
 *
 * Honesto: son horarios PROGRAMADOS (no posiciones en vivo). El hook NO pide
 * nada hasta que `enabled` es true (el usuario abre el pager), para no gastar
 * datos ni golpear el endpoint pesado de schedule.db en cada fila.
 */
import { useEffect, useState } from "react";

export interface ScheduledTime {
  /** "10:43" */
  horaStr: string;
  /** minutos desde ahora (puede ser negativo si justo pasó el umbral). */
  minutesFromNow: number;
}

interface CacheEntry { times: ScheduledTime[]; expiresAt: number; }
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<ScheduledTime[]>>();

// Los horarios programados no cambian en el día → TTL largo (5 min basta para
// recalcular minutesFromNow razonablemente sin re-fetch en cada apertura).
const TTL_MS = 5 * 60_000;

function keyFor(stopId: string, line: string) { return `${stopId}|${line}`; }

async function fetchSchedule(stopId: string, line: string): Promise<ScheduledTime[]> {
  const key = keyFor(stopId, line);
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) return cached.times;
  if (inflight.has(key)) return inflight.get(key)!;

  const p = fetch(`/api/stm/schedule?stop=${encodeURIComponent(stopId)}&line=${encodeURIComponent(line)}&limit=12`)
    .then((r) => (r.ok ? r.json() : { arrivals: [] }))
    .then((d) => {
      const times = ((d.arrivals || []) as { horaStr: string; minutesFromNow: number }[])
        .map((a) => ({ horaStr: a.horaStr, minutesFromNow: a.minutesFromNow }));
      cache.set(key, { times, expiresAt: Date.now() + TTL_MS });
      inflight.delete(key);
      return times;
    })
    .catch(() => {
      inflight.delete(key);
      return [];
    });

  inflight.set(key, p);
  return p;
}

export interface LineScheduleState {
  times: ScheduledTime[];
  loading: boolean;
}

export function useLineSchedule(
  stopId: string | null | undefined,
  lineName: string | null | undefined,
  enabled: boolean
): LineScheduleState {
  const [state, setState] = useState<LineScheduleState>({ times: [], loading: false });

  useEffect(() => {
    if (!enabled || !stopId || !lineName) {
      setState({ times: [], loading: false });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    fetchSchedule(stopId, lineName).then((times) => {
      if (cancelled) return;
      setState({ times, loading: false });
    });
    return () => { cancelled = true; };
  }, [stopId, lineName, enabled]);

  return state;
}
