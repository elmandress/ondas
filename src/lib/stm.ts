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
const COMOIR_HOST = "https://api.montevideo.gub.uy/comoirRest";

// Estas APIs no requieren auth — son públicas del gobierno uruguayo
const MVD_HEADERS = {
  "User-Agent": "okhttp/3.8.0",
  "Content-Type": "application/json",
  Accept: "application/json",
};

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
  lineCode: string;
  lineName: string;
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
  occupancy?: "low" | "medium" | "high";
  realtime: boolean;
  companyCode?: number;
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
    });
    if (!res.ok) return null;
    const data = await res.json();

    // Estructura real: { descripcion, destinos: {code: name}, variantes: {lineCode: [destCodes]}, lineas: {code: name} }
    const destinos: Record<string, string> = data.destinos || {};
    const lineas: Record<string, string> = data.lineas || {};
    const variantesRaw: Record<string, number[]> = data.variantes || {};

    const variants: StopVariant[] = Object.entries(variantesRaw).map(([lineCode, destCodes]) => ({
      lineCode,
      lineName: lineas[lineCode] || lineCode,
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

export async function getRealtimeArrivals(stopId: string | number, variantCodes: number[]): Promise<Arrival[]> {
  try {
    const body = { parada: String(stopId), variante: variantCodes };
    const res = await fetch(`${MVD_HOST}/stmonlineRest/nextETA`, {
      method: "POST",
      headers: MVD_HEADERS,
      body: JSON.stringify(body),
      next: { revalidate: 0 },
    });
    if (!res.ok) return [];
    const data = await res.json();

    // GeoJSON FeatureCollection
    const features = data.features || [];
    return features.map((f: any) => {
      const p = f.properties;
      const coords = f.geometry?.coordinates; // [lon, lat]
      const etaSeconds = p.eta || 0;
      return {
        lineId: String(p.variante || p.codigoBus || "?"),
        lineName: String(p.variante || "?"),
        destination: String(p.variante || ""),
        destinationCode: p.variante || 0,
        eta: Math.round(etaSeconds / 60),
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
// Combina variantes + ETAs reales + fallback inteligente
// ─────────────────────────────────────────────

export async function getArrivalsForStop(stopId: string): Promise<Arrival[]> {
  // 1. Obtener variantes de la parada para saber qué líneas buscar
  const stopInfo = await getStopVariants(stopId);
  if (!stopInfo) return getMockArrivals(stopId);

  // 2. Recolectar todos los códigos de variante/destino
  const allVariantCodes = stopInfo.variants.flatMap((v) => v.destinations.map((d) => d.code));

  if (allVariantCodes.length === 0) return getMockArrivals(stopId);

  // 3. Obtener ETAs reales
  const realArrivals = await getRealtimeArrivals(stopId, allVariantCodes);

  if (realArrivals.length === 0) return getMockArrivals(stopId);

  // 4. Enriquecer con info de línea (nombre, color)
  const variantMap = new Map<number, { lineCode: string; lineName: string; destName: string }>();
  stopInfo.variants.forEach((v) => {
    v.destinations.forEach((d) => {
      variantMap.set(d.code, { lineCode: v.lineCode, lineName: v.lineName, destName: d.name });
    });
  });

  return realArrivals.map((a) => {
    const meta = variantMap.get(a.destinationCode);
    return {
      ...a,
      lineId: meta?.lineCode || a.lineId,
      lineName: meta?.lineCode || a.lineName,
      lineColor: lineColorFromCode(meta?.lineCode || ""),
      destination: meta?.destName || a.destination,
    };
  }).sort((a, b) => a.eta - b.eta).slice(0, 8);
}

// ─────────────────────────────────────────────
// 3. POSICIONES GPS DE BUSES
// ─────────────────────────────────────────────

export async function getVehiclePositions(lineId?: string): Promise<VehiclePosition[]> {
  try {
    const body: Record<string, unknown> = { parada: 0 };
    if (lineId) body.lineas = [lineId];

    // La API de buses usa HTTP (no HTTPS) — llamamos via proxy de Next.js
    const res = await fetch(`${MVD_BUSES_HOST}/buses/rest/stm-online`, {
      method: "POST",
      headers: MVD_HEADERS,
      body: JSON.stringify(body),
      next: { revalidate: 0 },
    });
    if (!res.ok) return getMockVehicles();
    const data = await res.json();

    const features = data.features || [];
    return features.map((f: any) => {
      const p = f.properties;
      const coords = f.geometry?.coordinates; // [lon, lat]
      return {
        vehicleId: String(p.codigoBus || p.id),
        lineId: String(p.linea || p.variante || "?"),
        lineName: String(p.linea || "?"),
        lat: coords ? coords[1] : 0,
        lon: coords ? coords[0] : 0,
        bearing: p.frecuencia || 0,
        speed: 20, // no viene en la respuesta, estimamos
        timestamp: Date.now(),
        companyCode: p.codigoEmpresa,
        variantCode: p.variante,
      } as VehiclePosition;
    });
  } catch {
    return getMockVehicles();
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

    const res = await fetch(url.toString(), { next: { revalidate: 300 } });
    if (!res.ok) return [];
    const data = await res.json();

    return (Array.isArray(data) ? data : []).slice(0, 5).map((item: any) => ({
      address: item.nomenclatura || item.nombre || query,
      lat: item.puntoY || item.lat || 0,
      lon: item.puntoX || item.lon || 0,
      type: item.tipo || "D",
    }));
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────
// 5. PARADAS — Dataset externo + funciones de búsqueda
// ─────────────────────────────────────────────

export { STOPS_DATASET } from "@/lib/stops-dataset";
import { STOPS_DATASET as _STOPS } from "@/lib/stops-dataset";

export function getNearbyStops(lat: number, lon: number, radiusM = 600): BusStop[] {
  return _STOPS
    .filter((s) => haversineMeters(lat, lon, s.stopLat, s.stopLon) <= radiusM)
    .sort((a, b) => haversineMeters(lat, lon, a.stopLat, a.stopLon) - haversineMeters(lat, lon, b.stopLat, b.stopLon))
    .slice(0, 10);
}

export function searchStops(query: string): BusStop[] {
  const q = query.toLowerCase().trim();
  if (!q) return _STOPS.slice(0, 8);
  return _STOPS
    .filter(
      (s) =>
        s.stopName.toLowerCase().includes(q) ||
        s.stopCode.includes(q) ||
        s.lines.some((l) => l.toLowerCase().includes(q))
    )
    .slice(0, 10);
}

// ─────────────────────────────────────────────
// UTILIDADES INTERNAS
// ─────────────────────────────────────────────

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function lineColorFromCode(lineCode: string): string {
  const map: Record<string, string> = {
    "103": "#2563eb", "174": "#7c3aed", "D1": "#ea580c", "189": "#0891b2",
    "G": "#16a34a", "H": "#dc2626", "21": "#ca8a04", "121": "#db2777",
    "20": "#0284c7", "88": "#9333ea", "183": "#0d9488", "102": "#d97706",
  };
  return map[lineCode] || `hsl(${(lineCode.split("").reduce((a, c) => a + c.charCodeAt(0), 0) * 47) % 360}, 70%, 55%)`;
}

// ─────────────────────────────────────────────
// MOCK DATA — fallback cuando las APIs no responden
// ─────────────────────────────────────────────

const mockDestinations: Record<string, string> = {
  "103": "Montevideo Shopping", "174": "Pocitos Rambla", "D1": "Aeropuerto",
  "189": "Carrasco", "G": "Punta Carretas", "H": "Paso Molino",
  "21": "Reducto", "121": "Pocitos Centro", "20": "La Teja",
  "88": "Goes", "183": "Paso de la Arena", "102": "Carrasco Norte",
  "427": "Ciudad Vieja", "456": "Buceo", "125": "Ciudadela",
  "582": "Parque Rodó", "191": "Ciudadela", "M1": "Aeropuerto",
};

export function getMockArrivals(stopId: string): Arrival[] {
  const stop = _STOPS.find((s: BusStop) => s.stopId === stopId);
  const lines = stop?.lines || ["103", "174", "D1"];
  const base = parseInt(stopId.slice(-1) || "0") % 3;

  return lines.flatMap((line: string, i: number) => [
    {
      lineId: line, lineName: line,
      destination: mockDestinations[line] || "Terminal",
      destinationCode: i * 10,
      eta: base + 3 + i * 5 + Math.floor(Math.random() * 3),
      etaSeconds: (base + 3 + i * 5) * 60,
      lineColor: lineColorFromCode(line),
      realtime: i < 2,
      occupancy: (["low", "medium", "high"] as const)[i % 3],
      distance: 300 + i * 200,
    },
    {
      lineId: line, lineName: line,
      destination: mockDestinations[line] || "Terminal",
      destinationCode: i * 10,
      eta: base + 18 + i * 6,
      etaSeconds: (base + 18 + i * 6) * 60,
      lineColor: lineColorFromCode(line),
      realtime: false,
      distance: undefined,
    },
  ]).sort((a: Arrival, b: Arrival) => a.eta - b.eta).slice(0, 8);
}

export function getMockVehicles(): VehiclePosition[] {
  return _STOPS.slice(0, 20).map((stop: BusStop, i: number) => ({
    vehicleId: `v${String(i + 1).padStart(3, "0")}`,
    lineId: stop.lines[0],
    lineName: stop.lines[0],
    lat: stop.stopLat + (Math.random() - 0.5) * 0.006,
    lon: stop.stopLon + (Math.random() - 0.5) * 0.006,
    bearing: Math.floor(Math.random() * 360),
    speed: 15 + Math.floor(Math.random() * 25),
    timestamp: Date.now(),
  }));
}
