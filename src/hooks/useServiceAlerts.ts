"use client";

import { useEffect, useState } from "react";
import type { ServiceAlert } from "@/app/api/stm/alerts/route";

/**
 * Avisos/desvíos oficiales (feed de Cómo Ir vía /api/stm/alerts). Se carga una vez al
 * montar. Degradable: si falla o no hay, devuelve lista vacía y la UI cae al link de la
 * fuente oficial. Cacheado a nivel módulo para no re-pedir en cada render.
 */
let _cache: ServiceAlert[] | null = null;
let _inflight: Promise<ServiceAlert[]> | null = null;

function load(): Promise<ServiceAlert[]> {
  if (_cache) return Promise.resolve(_cache);
  if (_inflight) return _inflight;
  _inflight = fetch("/api/stm/alerts")
    .then((r) => (r.ok ? r.json() : { alerts: [] }))
    .then((d: { alerts?: ServiceAlert[] }) => { _cache = d.alerts ?? []; _inflight = null; return _cache; })
    .catch(() => { _inflight = null; return []; });
  return _inflight;
}

export function useServiceAlerts(): ServiceAlert[] {
  const [alerts, setAlerts] = useState<ServiceAlert[]>(_cache ?? []);
  useEffect(() => {
    let active = true;
    load().then((a) => { if (active) setAlerts(a); });
    return () => { active = false; };
  }, []);
  return alerts;
}
