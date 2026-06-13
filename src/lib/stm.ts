/**
 * Cliente para las APIs públicas del STM (Sistema de Transporte Metropolitano) de Montevideo.
 * Basado en ingeniería inversa documentada de la app "Cómo Ir" oficial.
 *
 * APIs utilizadas:
 *   1. https://m.montevideo.gub.uy/transporteRest/variantes/{parada-id}  → líneas/variantes de parada
 *   2. https://m.montevideo.gub.uy/stmonlineRest/nextETA (POST)          → ETAs en tiempo real
 *   3. http://www.montevideo.gub.uy/buses/rest/stm-online (POST)         → posiciones GPS buses
 *   4. https://direcciones.ide.uy/api/v0/geocode/BusquedaDireccion       → geocoding direcciones
 *   5. https://api.montevideo.gub.uy/comoirRest/                         → planificación de rutas
 */

const MVD_HOST = "https://m.montevideo.gub.uy";
const MVD_BUSES_HOST = "http://www.montevideo.gub.uy"; // solo HTTP
const IDE_GEOCODE = "https://direcciones.ide.uy/api/v0/geocode/BusquedaDireccion";

// Estas APIs no requieren auth — son públicas del gobierno uruguayo
const MVD_HEADERS = {
  "User-Agent": "okhttp/3.8.0",
  "Content-Type": "application/json",
  Accept: "application/json",
};

import { haversineMeters } from "@/lib/geo";

// ─────────────────────────────────────────────
// TIPOS PÚBLICOS
// ─────────────────────────────────────────────

export interface BusStop {
  stopId: string;
  stopCode: string;
  stopName: string;
  stopLat: number;
  stopLon: number;
  lines: string[];
}

export interface StopVariant {
  lineCode: string;    // número de línea real visible al usuario (ej: "76", "329")
  lineName: string;    // idem (para display)
  variantCode?: string; // código interno de variante STM (ej: "480", "448")
  destinations: { code: number; name: string }[];
}

export interface StopInfo {
  stopId: string;
  description: string;
  variants: StopVariant[];
}

export interface Arrival {
  lineId: string;
  lineName: string;
  lineColor?: string;
  destination: string;
  destinationCode: number;
  eta: number;        // minutos
  etaSeconds: number;
  distance?: number;  // metros
  vehicleId?: string;
  lat?: number;
  lon?: number;
  /**
   * @deprecated SRS FR-6.4: STM no publica ocupación por bus.
   * Heurística por hora del día daba "muy lleno" a casi todo en hora pico → engañoso.
   * Mantenemos el campo opcional para no romper consumidores, pero la app nunca lo setea.
   */
  occupancy?: "low" | "medium" | "high";
  realtime: boolean;
  companyCode?: number;
  /** true si el destino real del bus difiere del oficial (trayecto acortado, frecuente de madrugada) */
  isShortened?: boolean;
  /**
   * @deprecated SRS NFR-6.3: no se puede verificar WiFi por bus individual.
   * Mantenemos el campo para no romper consumidores existentes pero nunca lo setteamos.
   */
  hasWifi?: boolean;
  /** true si el dato viene de horario programado (no GPS en vivo) */
  isScheduled?: boolean;
  /** R61 (patrón Transit): hora del SIGUIENTE programado de la misma línea
   *  ("luego 23:55") — responde "¿y el de después?" sin abrir el pager. */
  nextHoraStr?: string;
  /**
   * Accesibilidad REAL por bus (dato oficial API IM).
   * Valores típicos: "PISO BAJO", "PLATAFORMA ELEVADORA", "PISO ALTO", "COMÚN".
   * Solo definido cuando la respuesta vino de la API autenticada nueva.
   */
  access?: string;
  /** "Aire Acondicionado", "Sin datos", etc. */
  thermalConfort?: string;
  /** Paradas restantes hasta la parada destino (según GTFS). */
  remainingStops?: number;
  /** ETA APROXIMADO: estimado por distancia en línea recta + velocidad asumida (cuando
   *  el GTFS no pudo ubicar el bus en el recorrido). Menos preciso que el ETA por
   *  paradas → la UI lo muestra con "~" para no prometer exactitud (honestidad). */
  etaApprox?: boolean;
  /** F1.4: esta llegada es la ÚLTIMA corrida programada del día de su línea aquí.
   *  Dato duro de schedule.db. La UI lo resalta ("último del día"). */
  isLastOfDay?: boolean;
  /** Empresa operadora del bus en vivo (CUTCSA, COETC…), de la API. Permite mostrar
   *  empresa+web al ver el detalle de la línea, también para líneas urbanas de MVD. */
  company?: string;
}

export interface VehiclePosition {
  vehicleId: string;
  lineId: string;
  lineName: string;
  lat: number;
  lon: number;
  bearing: number;
  speed: number;
  timestamp: number;
  companyCode?: number;
  variantCode?: number;
  /** Destino real reportado por el bus (puede diferir del oficial = trayecto acortado) */
  destinoDesc?: string;
  /** Sublínea descriptiva (ej: "PUNTA CARRETAS -- PEÑAROL") */
  sublinea?: string;
  /** Empresa operadora (string, ej "CUTCSA") si la fuente la reporta. */
  company?: string;
  /** Datos enriquecidos del GPS del INTERIOR (Busmatick): próxima parada, atraso (min),
   *  ocupación (pasajeros). Ninguna otra fuente uruguaya los muestra bien. */
  nextStop?: string;
  delayMin?: number;
  occupancy?: number;
}

export interface GeoAddress {
  address: string;
  lat: number;
  lon: number;
  type: string;
}

// ─────────────────────────────────────────────
// 1. VARIANTES / LÍNEAS DE UNA PARADA
// ─────────────────────────────────────────────

export async function getStopVariants(stopId: string | number): Promise<StopInfo | null> {
  try {
    const res = await fetch(`${MVD_HOST}/transporteRest/variantes/${stopId}`, {
      headers: MVD_HEADERS,
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const data = await res.json();

    // Estructura real de la API STM:
    //   descripcion: "AV GRAL GARIBALDI y RIVADAVIA"
    //   lineas: { "480": "76", "448": "329", "90": "187" }  ← variantCode → lineNumber
    //   variantes: { "480": [4947, 4949, ...], "448": [...], "90": [...] }  ← variantCode → [destCodes]
    //   destinos: { "4947": "PUNTA CARRETAS (POR PARQUE)", ... }  ← destCode → nombre
    const destinos: Record<string, string> = data.destinos || {};
    const lineasMap: Record<string, string> = data.lineas || {}; // variantCode → lineNumber real
    const variantesRaw: Record<string, number[]> = data.variantes || {}; // variantCode → [destCodes]

    const variants: StopVariant[] = Object.entries(variantesRaw).map(([variantCode, destCodes]) => ({
      lineCode: lineasMap[variantCode] || variantCode, // ← USAR el lineNumber real, no el variant code
      lineName: lineasMap[variantCode] || variantCode,
      variantCode, // guardamos el variant code original para nextETA
      destinations: destCodes.map((dc) => ({
        code: dc,
        name: destinos[String(dc)] || `Destino ${dc}`,
      })),
    }));

    return {
      stopId: String(stopId),
      description: data.descripcion || `Parada ${stopId}`,
      variants,
    };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────
// 2. ETAs EN TIEMPO REAL (nextETA)
// ─────────────────────────────────────────────

/**
 * Llamada real al endpoint nextETA.
 * Formato correcto descubierto experimentalmente (24/5/2026):
 *   POST /stmonlineRest/nextETA
 *   Body: { parada: <number>, linea: ["103", "174", ...] }   // ⚠ NÚMEROS DE LÍNEA, no variant codes
 * Respuesta: GeoJSON FeatureCollection con buses próximos:
 *   { codigoBus, codigoEmpresa, variante, eta (segundos), dist (metros), pos }
 */
export async function getRealtimeArrivals(stopId: string | number, lineCodes: string[]): Promise<Arrival[]> {
  if (lineCodes.length === 0) return [];
  try {
    const body = { parada: Number(stopId), linea: lineCodes };
    const res = await fetch(`${MVD_HOST}/stmonlineRest/nextETA`, {
      method: "POST",
      headers: MVD_HEADERS,
      body: JSON.stringify(body),
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (data.error) return [];

    const features = data.features || [];
    return features.map((f: { properties: Record<string, number>; geometry?: { coordinates: [number, number] } }) => {
      const p = f.properties;
      const coords = f.geometry?.coordinates;
      const etaSeconds = p.eta || 0;
      return {
        lineId: "",          // se rellena al cruzar con variantMap (línea comercial)
        lineName: "",        // idem
        destination: "",     // se rellena con el destino de la variante
        destinationCode: p.variante || 0,
        eta: Math.max(0, Math.round(etaSeconds / 60)),
        etaSeconds,
        distance: p.dist,
        vehicleId: String(p.codigoBus),
        lat: coords ? coords[1] : undefined,
        lon: coords ? coords[0] : undefined,
        realtime: true,
        companyCode: p.codigoEmpresa,
      } as Arrival;
    });
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────
// FUNCIÓN PRINCIPAL: llegadas completas de una parada
// Combina variantes (cuáles líneas paran) + ETAs en vivo (nextETA) +
// fallback con posiciones GPS (stm-online) cuando nextETA está vacío.
// ─────────────────────────────────────────────

export async function getArrivalsForStop(stopId: string): Promise<Arrival[]> {
  // 1. Variantes reales de la parada (líneas que paran ahí HOY, según API STM)
  const stopInfo = await getStopVariants(stopId);
  if (!stopInfo) return [];

  const lineCodes = stopInfo.variants.map((v) => v.lineCode);
  if (lineCodes.length === 0) return [];

  // 2. Mapa de variantes → línea+destino comercial (lo usamos siempre)
  const variantMap = new Map<number, { lineCode: string; destName: string }>();
  stopInfo.variants.forEach((v) => {
    v.destinations.forEach((d) => {
      variantMap.set(d.code, { lineCode: v.lineCode, destName: d.name });
    });
  });

  // 3. ETAs en vivo desde nextETA (la API oficial)
  const realArrivals = await getRealtimeArrivals(stopId, lineCodes);

  if (realArrivals.length > 0) {
    // Enriquecer con metadata de línea/destino.
    // SRS NFR-6.3 (honestidad): NO se asigna hasWifi — solo ~25% de la flota CUTCSA
    // es eléctrica con WiFi, y no podemos saber por bus individual cuál es. Mostrar
    // WiFi a todos los CUTCSA sería información falsa.
    const enriched = realArrivals.map((a) => {
      const meta = variantMap.get(a.destinationCode);
      return {
        ...a,
        lineId: meta?.lineCode || String(a.destinationCode),
        lineName: meta?.lineCode || String(a.destinationCode),
        lineColor: lineColorFromCode(meta?.lineCode || ""),
        destination: meta?.destName || `Variante ${a.destinationCode}`,
      };
    });
    return enriched.sort((x, y) => x.eta - y.eta).slice(0, 30);
  }

  // 4. FALLBACK: nextETA vacío → calcular ETA aproximada desde stm-online (GPS en vivo)
  return await arrivalsFromVehiclePositions(stopId, stopInfo, variantMap);
}

/**
 * Fallback: cuando nextETA devuelve vacío, calculamos ETAs aproximadas
 * usando las posiciones GPS de stm-online + distancia al stop + velocidad estimada.
 */
async function arrivalsFromVehiclePositions(
  stopId: string,
  stopInfo: StopInfo,
  variantMap: Map<number, { lineCode: string; destName: string }>,
): Promise<Arrival[]> {
  // Necesitamos coordenadas de la parada para calcular distancia
  // Las leemos del dataset cacheado (cliente o server)
  const stops = getStopsForLookup();
  const stop = stops.find((s) => s.stopId === stopId);
  if (!stop) return [];

  const lineCodes = stopInfo.variants.map((v) => v.lineCode);
  const vehicles = await getVehiclePositions(undefined, lineCodes);
  if (vehicles.length === 0) return [];

  const AVG_SPEED_MS = 6.5; // ~23 km/h promedio urbano con paradas
  const arrivals: Arrival[] = [];

  // Construir índice lineCode → meta para matching rápido por nombre de línea
  // Esto resuelve el caso donde variantCode del GPS (ej: 9221) no coincide con
  // los códigos de destino en variantMap (ej: 4877, 4882) — pero la linea ("76") sí coincide.
  const lineMetaIndex = new Map<string, { lineCode: string; destName: string }>();
  for (const [, meta] of variantMap) {
    if (!lineMetaIndex.has(meta.lineCode)) {
      lineMetaIndex.set(meta.lineCode, meta);
    }
  }

  for (const v of vehicles) {
    // Matching: primero por variantCode exacto, luego por lineName comercial
    const meta = variantMap.get(v.variantCode || -1) || lineMetaIndex.get(v.lineName);
    if (!meta) continue;

    const distanceM = haversineMeters(v.lat, v.lon, stop.stopLat, stop.stopLon);
    if (distanceM > 8000) continue;

    const etaSeconds = Math.round(distanceM / AVG_SPEED_MS);
    const distanceToReport = distanceM;
    // NOTA: el filtro upstream (FR-2) se aplica en /api/stm/arrivals con routes-server,
    // no acá, para evitar que el bundler intente meter fs en el cliente.

    // Detectar destino acortado (feedback Guille): si destinoDesc del GPS difiere del oficial
    const officialDest = meta.destName;
    const realDest = v.destinoDesc || officialDest;
    const isShortened = !!(v.destinoDesc && v.destinoDesc !== officialDest && officialDest.length > 0);

    arrivals.push({
      lineId: meta.lineCode,
      lineName: meta.lineCode,
      lineColor: lineColorFromCode(meta.lineCode),
      destination: isShortened ? `${realDest}` : officialDest,
      destinationCode: v.variantCode || 0,
      isShortened,
      eta: Math.max(0, Math.round(etaSeconds / 60)),
      etaSeconds,
      distance: Math.round(distanceToReport),
      vehicleId: v.vehicleId,
      lat: v.lat,
      lon: v.lon,
      realtime: true,
      companyCode: v.companyCode,
    });
  }

  return arrivals.sort((a, b) => a.eta - b.eta).slice(0, 25);
}

/** Lookup compartido server/client — utiliza el helper interno */
function getStopsForLookup(): BusStop[] {
  // En cliente: getStopsSync(); en server: getStops() lo maneja via require diferido
  return getStops();
}

// ─────────────────────────────────────────────
// 3. POSICIONES GPS DE BUSES
// ─────────────────────────────────────────────

/**
 * Posiciones GPS reales de buses (stm-online).
 * Acepta filtro por una línea (string) o varias (array).
 * Si no se filtra, devuelve TODOS los buses activos en el sistema.
 */
export async function getVehiclePositions(
  lineId?: string,
  lineIds?: string[],
): Promise<VehiclePosition[]> {
  try {
    const body: Record<string, unknown> = {};
    if (lineId) body.lineas = [lineId];
    else if (lineIds && lineIds.length > 0) body.lineas = lineIds;

    const res = await fetch(`${MVD_BUSES_HOST}/buses/rest/stm-online`, {
      method: "POST",
      headers: MVD_HEADERS,
      body: JSON.stringify(body),
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = await res.json();

    const features = data.features || [];
    return features.map((f: { properties: Record<string, string | number>; geometry?: { coordinates: [number, number] } }) => {
      const p = f.properties;
      const coords = f.geometry?.coordinates;
      return {
        vehicleId: String(p.codigoBus || p.id),
        lineId: String(p.linea || "?"),
        lineName: String(p.linea || "?"),
        lat: coords ? coords[1] : 0,
        lon: coords ? coords[0] : 0,
        bearing: 0, // no viene
        speed: Number(p.velocidad) || 0,
        timestamp: Date.now(),
        companyCode: Number(p.codigoEmpresa) || undefined,
        variantCode: Number(p.variante) || undefined,
        destinoDesc: typeof p.destinoDesc === "string" ? p.destinoDesc : undefined,
        sublinea: typeof p.sublinea === "string" ? p.sublinea : undefined,
      } as VehiclePosition;
    });
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────
// 4. GEOCODING — Buscar direcciones en Montevideo
// ─────────────────────────────────────────────

export async function geocodeAddress(query: string): Promise<GeoAddress[]> {
  try {
    const url = new URL(IDE_GEOCODE);
    url.searchParams.set("nombre", query);
    url.searchParams.set("tipo", "D");
    url.searchParams.set("limit", "5");

    const res = await fetch(url.toString(), { next: { revalidate: 300 }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return [];
    const data = await res.json();

    return (Array.isArray(data) ? data : []).slice(0, 5).map((raw: unknown) => {
      const item = raw as Record<string, unknown>;
      return {
        address: (item.nomenclatura || item.nombre || query) as string,
        lat: (item.puntoY || item.lat || 0) as number,
        lon: (item.puntoX || item.lon || 0) as number,
        type: (item.tipo || "D") as string,
      };
    });
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────
// 5. PARADAS — Dataset externo + funciones de búsqueda
// ─────────────────────────────────────────────

export { STOPS_DATASET, loadStops, getStopsSync } from "@/lib/stops-dataset";
import { getStopsSync } from "@/lib/stops-dataset";

/**
 * Helper para obtener el dataset cacheado. En cliente devuelve el cache
 * (vacío hasta que `loadStops()` haya terminado). En server devuelve [] —
 * las API routes que necesiten paradas deben leerlas via fetch o fs ellas mismas.
 */
function getStops(): BusStop[] {
  return getStopsSync();
}

export function getNearbyStops(lat: number, lon: number, radiusM = 600, limit = 20): BusStop[] {
  return getStops()
    .filter((s) => haversineMeters(lat, lon, s.stopLat, s.stopLon) <= radiusM)
    .sort((a, b) => haversineMeters(lat, lon, a.stopLat, a.stopLon) - haversineMeters(lat, lon, b.stopLat, b.stopLon))
    .slice(0, limit);
}

/** Paradas dentro de un bounding box (para viewport del mapa) */
export function getStopsInBounds(minLat: number, maxLat: number, minLon: number, maxLon: number, limit = 300): BusStop[] {
  return getStops()
    .filter((s) => s.stopLat >= minLat && s.stopLat <= maxLat && s.stopLon >= minLon && s.stopLon <= maxLon)
    .slice(0, limit);
}

/**
 * Búsqueda de paradas con RANKING real (antes era filter + slice sin orden):
 *   código exacto > código prefijo > nombre empieza > palabra empieza > incluye > línea.
 * Si se pasa `near` (ubicación del usuario), suma un boost por cercanía que DESEMPATA
 * sin dominar — "Pocitos" muestra primero la parada de Pocitos que tenés al lado, no una
 * cualquiera. Esto es lo que hace que la búsqueda se sienta inteligente.
 */
function normStr(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function searchStops(query: string, near?: { lat: number; lon: number }): BusStop[] {
  const stops = getStops();
  const q = normStr(query).trim();
  if (!q) return stops.slice(0, 8);

  const scored: Array<{ s: BusStop; score: number; dist: number }> = [];
  for (const s of stops) {
    const name = normStr(s.stopName);
    let score = 0;
    if (s.stopCode === q) score = 100;
    else if (s.stopCode.startsWith(q)) score = 88;
    else if (name.startsWith(q)) score = 80;
    else if (q.length >= 2 && name.split(/[\s,–-]+/).some((w) => w.startsWith(q))) score = 66;
    else if (q.length >= 3 && name.includes(q)) score = 50;
    else if (s.lines.some((l) => l.toLowerCase() === q)) score = 45;
    else if (s.lines.some((l) => l.toLowerCase().includes(q))) score = 36;
    if (score === 0) continue;

    // Boost por proximidad (0..22): solo desempata. 0 m → +22; ~3 km → ~0.
    let dist = Infinity;
    if (near) {
      dist = haversineMeters(near.lat, near.lon, s.stopLat, s.stopLon);
      score += Math.max(0, 22 - (dist / 3000) * 22);
    }
    scored.push({ s, score, dist });
  }

  scored.sort((a, b) => b.score - a.score || a.dist - b.dist);
  return scored.slice(0, 15).map((x) => x.s);
}

// ─────────────────────────────────────────────
// UTILIDADES INTERNAS
// ─────────────────────────────────────────────

export function lineColorFromCode(lineCode: string): string {
  const map: Record<string, string> = {
    "103": "#2563eb", "174": "#7c3aed", "D1": "#ea580c", "189": "#0891b2",
    "468": "#16a34a", "H": "#dc2626", "21": "#ca8a04", "121": "#db2777",
    "20": "#0284c7", "88": "#9333ea", "183": "#0d9488", "102": "#d97706",
  };
  // Canónico para que la misma línea tenga el MISMO color venga de donde venga el
  // dato (el GPS reporta "CE1", el GTFS "Ce1" — sin esto el hash daba 2 colores).
  const canon = lineCode.trim().toUpperCase();
  return map[canon] || `hsl(${(canon.split("").reduce((a, c) => a + c.charCodeAt(0), 0) * 47) % 360}, 70%, 55%)`;
}

/**
 * Líneas confirmadas 100% ELÉCTRICAS (flota BYD con WiFi + USB + AC) — dato verificable,
 * NO inventado. Solo afirmamos WiFi en estas líneas; en el resto NO claimeamos, porque
 * los ~177 eléctricos (de 1547) ROTAN por toda la red y la API no expone WiFi por bus.
 *
 * Fuente: "Nuevo circuito eléctrico" (montevideo.gub.uy) — el circuito 100% eléctrico
 * son TRES líneas: CA1→CE1, D1→DE1, 14→E14. WiFi/USB confirmado en las BYD por la ficha
 * de la línea D1 (Wikipedia) y la nota de los 50 nuevos eléctricos BYD. Hay churn de nombres
 * (mayo 2025: DE1 volvió a D1), así que incluimos AMBAS variantes para cubrir lo que devuelva la API.
 * Mantener conservador: agregar solo líneas confirmadas como 100% eléctricas.
 */
export const ELECTRIC_WIFI_LINES = new Set<string>([
  "CA1", "CE1",   // Ciudad Vieja ↔ (circuito eléctrico)
  "D1", "DE1",    // Ciudad Vieja ↔ Carrasco
  "14", "E14",    // Pocitos / Punta Carretas / Parque Rodó ↔ Centro / Ciudad Vieja
]);
export function lineHasWifi(lineName: string): boolean {
  return ELECTRIC_WIFI_LINES.has(lineName.trim().toUpperCase());
}

/** ¿La llegada es de un bus accesible (piso bajo / plataforma)? Dato oficial por bus. */
export function isAccessibleArrival(a: Pick<Arrival, "access">): boolean {
  return a.access === "PISO BAJO" || a.access === "PLATAFORMA ELEVADORA";
}
/** ¿La llegada es de un bus con aire acondicionado? Dato oficial por bus. */
export function arrivalHasAc(a: Pick<Arrival, "thermalConfort">): boolean {
  return a.thermalConfort === "Aire Acondicionado";
}

// Mocks eliminados — la app NUNCA inventa datos. Si la API no responde,
// se muestra estado vacío real al usuario.
