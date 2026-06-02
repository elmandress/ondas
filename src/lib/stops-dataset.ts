export interface StopRecord {
  stopId: string;
  stopCode: string;
  stopName: string;
  stopLat: number;
  stopLon: number;
  lines: string[];
}

/**
 * Lazy-loader del dataset completo de paradas (4940 paradas reales).
 * El JSON real está en /public/stops.json para no inflar el bundle inicial.
 * Una vez cargado, se cachea en memoria del cliente.
 */

let cache: StopRecord[] | null = null;
let loading: Promise<StopRecord[]> | null = null;

export async function loadStops(): Promise<StopRecord[]> {
  if (cache) return cache;
  if (loading) return loading;
  // STM/metropolitano (stops.json) + paradas del INTERIOR inferidas del GPS en vivo
  // (interior-stops.json, ver scripts/collect-interior-stops). Así el home, la búsqueda
  // y el mapa muestran paradas también en Maldonado/Paysandú/etc., no solo en MVD.
  loading = Promise.all([
    fetch("/stops.json").then((r) => r.json()).catch(() => [] as StopRecord[]),
    fetch("/interior-stops.json").then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
  ])
    .then(([stm, interiorRaw]: [StopRecord[], Record<string, { zona: string; code: string; name: string; lat: number; lon: number; lines?: string[] }>]) => {
      const interior: StopRecord[] = Object.values(interiorRaw || {}).map((s) => ({
        stopId: `int-${s.zona}-${s.code}`,
        stopCode: s.code,
        stopName: s.name || "Parada",
        stopLat: s.lat,
        stopLon: s.lon,
        lines: s.lines || [],
      }));
      cache = [...stm, ...interior];
      loading = null;
      return cache;
    })
    .catch((err) => {
      loading = null;
      console.error("Failed to load stops dataset:", err);
      return [];
    });
  return loading;
}

/** Acceso sincrónico al cache — usar SOLO después de `await loadStops()` */
export function getStopsSync(): StopRecord[] {
  return cache || [];
}


/**
 * Compat: muchos componentes hacen `STOPS_DATASET.find(...)` esperando array sincrónico.
 * Devuelve un proxy al cache actual. Si aún no se cargó, será [] hasta que `loadStops()` termine.
 */
export const STOPS_DATASET: StopRecord[] = new Proxy([] as StopRecord[], {
  get(_target, prop) {
    const arr = cache || [];
    return (arr as never)[prop];
  },
});
