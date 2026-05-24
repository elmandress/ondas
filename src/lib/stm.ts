// Cliente para la API pública del STM (Sistema de Transporte Metropolitano de Montevideo)
// Credenciales del plan Basico
const STM_CLIENT_ID = "fea2a198";
const STM_CLIENT_SECRET = "42b0aee5e13d3c786b0d9397af6d3032";
const STM_BASE = "https://mvdapi.xyz/v2";

export interface BusStop {
  stopId: string;
  stopCode: string;
  stopName: string;
  stopLat: number;
  stopLon: number;
  lines: string[];
}

export interface Arrival {
  lineId: string;
  lineName: string;
  lineColor?: string;
  destination: string;
  eta: number; // minutos
  etaSeconds: number;
  vehicleId?: string;
  lat?: number;
  lon?: number;
  occupancy?: "low" | "medium" | "high";
  realtime: boolean;
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
}

export interface LineRoute {
  lineId: string;
  lineName: string;
  color: string;
  shape: [number, number][];
  stops: BusStop[];
}

export interface StmTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

// Cache simple de token en memoria
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 10000) {
    return cachedToken.token;
  }

  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: STM_CLIENT_ID,
    client_secret: STM_CLIENT_SECRET,
  });

  const res = await fetch(`${STM_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    throw new Error(`STM auth failed: ${res.status}`);
  }

  const data: StmTokenResponse = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cachedToken.token;
}

async function stmFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const token = await getAccessToken();
  const url = new URL(`${STM_BASE}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    next: { revalidate: 15 },
  });

  if (!res.ok) {
    throw new Error(`STM API error ${res.status} on ${path}`);
  }

  return res.json() as Promise<T>;
}

// Paradas cercanas a coordenadas
export async function getNearbyStops(lat: number, lon: number, radius = 500): Promise<BusStop[]> {
  try {
    const data = await stmFetch<{ stops: BusStop[] }>("/stops/nearby", {
      lat: lat.toString(),
      lon: lon.toString(),
      radius: radius.toString(),
    });
    return data.stops || [];
  } catch {
    return getMockNearbyStops(lat, lon);
  }
}

// Próximas llegadas a una parada
export async function getArrivals(stopId: string): Promise<Arrival[]> {
  try {
    const data = await stmFetch<{ arrivals: Arrival[] }>(`/stops/${stopId}/arrivals`);
    return (data.arrivals || []).slice(0, 8);
  } catch {
    return getMockArrivals(stopId);
  }
}

// Posiciones de vehículos en tiempo real
export async function getVehiclePositions(lineId?: string): Promise<VehiclePosition[]> {
  try {
    const params: Record<string, string> | undefined = lineId ? { lineId } : undefined;
    const data = await stmFetch<{ vehicles: VehiclePosition[] }>("/vehicles", params);
    return data.vehicles || [];
  } catch {
    return getMockVehicles();
  }
}

// Buscar paradas por nombre o código
export async function searchStops(query: string): Promise<BusStop[]> {
  try {
    const data = await stmFetch<{ stops: BusStop[] }>("/stops/search", { q: query });
    return data.stops || [];
  } catch {
    return getMockSearchStops(query);
  }
}

// Ruta de una línea
export async function getLineRoute(lineId: string): Promise<LineRoute | null> {
  try {
    const data = await stmFetch<LineRoute>(`/lines/${lineId}/route`);
    return data;
  } catch {
    return null;
  }
}

// ──────────────────────────────────────────────────────────────
// MOCK DATA — se usa cuando la API no responde durante desarrollo
// ──────────────────────────────────────────────────────────────

function getMockNearbyStops(lat: number, lon: number): BusStop[] {
  return [
    {
      stopId: "stop_001",
      stopCode: "4521",
      stopName: "18 de Julio esq. Ejido",
      stopLat: lat + 0.001,
      stopLon: lon + 0.001,
      lines: ["103", "174", "D1", "189"],
    },
    {
      stopId: "stop_002",
      stopCode: "4522",
      stopName: "18 de Julio esq. Río Branco",
      stopLat: lat - 0.001,
      stopLon: lon - 0.001,
      lines: ["103", "174"],
    },
    {
      stopId: "stop_003",
      stopCode: "3311",
      stopName: "Av. Italia esq. Propios",
      stopLat: lat + 0.002,
      stopLon: lon - 0.002,
      lines: ["G", "H", "21"],
    },
  ];
}

function getMockArrivals(stopId: string): Arrival[] {
  const now = Date.now();
  const base = stopId === "stop_001" ? 0 : 2;
  return [
    {
      lineId: "103",
      lineName: "103",
      destination: "Centro",
      eta: base + 3,
      etaSeconds: (base + 3) * 60,
      lineColor: "#2563eb",
      realtime: true,
      occupancy: "medium",
      lat: -34.906,
      lon: -56.189,
    },
    {
      lineId: "174",
      lineName: "174",
      destination: "Pocitos",
      eta: base + 7,
      etaSeconds: (base + 7) * 60,
      lineColor: "#7c3aed",
      realtime: true,
      occupancy: "low",
      lat: -34.903,
      lon: -56.184,
    },
    {
      lineId: "D1",
      lineName: "D1",
      destination: "Aeropuerto",
      eta: base + 12,
      etaSeconds: (base + 12) * 60,
      lineColor: "#ea580c",
      realtime: false,
      occupancy: "high",
    },
    {
      lineId: "189",
      lineName: "189",
      destination: "Portones",
      eta: base + 18,
      etaSeconds: (base + 18) * 60,
      lineColor: "#0891b2",
      realtime: false,
      occupancy: "low",
    },
    {
      lineId: "103",
      lineName: "103",
      destination: "Centro",
      eta: base + 23,
      etaSeconds: (base + 23) * 60,
      lineColor: "#2563eb",
      realtime: false,
      occupancy: "medium",
    },
  ];
}

function getMockVehicles(): VehiclePosition[] {
  const base = { lat: -34.9058, lon: -56.1882 };
  return [
    { vehicleId: "v001", lineId: "103", lineName: "103", lat: base.lat + 0.002, lon: base.lon + 0.003, bearing: 45, speed: 22, timestamp: Date.now() },
    { vehicleId: "v002", lineId: "174", lineName: "174", lat: base.lat - 0.003, lon: base.lon + 0.001, bearing: 180, speed: 18, timestamp: Date.now() },
    { vehicleId: "v003", lineId: "D1", lineName: "D1", lat: base.lat + 0.005, lon: base.lon - 0.004, bearing: 270, speed: 30, timestamp: Date.now() },
    { vehicleId: "v004", lineId: "103", lineName: "103", lat: base.lat - 0.001, lon: base.lon - 0.006, bearing: 90, speed: 15, timestamp: Date.now() },
    { vehicleId: "v005", lineId: "189", lineName: "189", lat: base.lat + 0.007, lon: base.lon + 0.005, bearing: 135, speed: 25, timestamp: Date.now() },
    { vehicleId: "v006", lineId: "G", lineName: "G", lat: base.lat - 0.005, lon: base.lon + 0.008, bearing: 225, speed: 20, timestamp: Date.now() },
    { vehicleId: "v007", lineId: "174", lineName: "174", lat: base.lat + 0.009, lon: base.lon - 0.002, bearing: 315, speed: 28, timestamp: Date.now() },
    { vehicleId: "v008", lineId: "21", lineName: "21", lat: base.lat - 0.008, lon: base.lon - 0.009, bearing: 60, speed: 12, timestamp: Date.now() },
  ];
}

function getMockSearchStops(query: string): BusStop[] {
  const all = [
    { stopId: "s1", stopCode: "4521", stopName: "18 de Julio esq. Ejido", stopLat: -34.906, stopLon: -56.189, lines: ["103", "174", "D1"] },
    { stopId: "s2", stopCode: "2201", stopName: "Punta Carretas Shopping", stopLat: -34.921, stopLon: -56.165, lines: ["G", "H", "121"] },
    { stopId: "s3", stopCode: "3301", stopName: "Tres Cruces Terminal", stopLat: -34.896, stopLon: -56.165, lines: ["Cutcsa", "D1", "20"] },
    { stopId: "s4", stopCode: "1101", stopName: "Ciudad Vieja - Plaza Independencia", stopLat: -34.908, stopLon: -56.201, lines: ["103", "174"] },
    { stopId: "s5", stopCode: "5501", stopName: "Pocitos - Av. Brasil", stopLat: -34.919, stopLon: -56.154, lines: ["174", "121", "G"] },
    { stopId: "s6", stopCode: "6601", stopName: "Malvín - Av. Italia", stopLat: -34.901, stopLon: -56.139, lines: ["G", "189"] },
    { stopId: "s7", stopCode: "7701", stopName: "Carrasco - Av. Italia", stopLat: -34.876, stopLon: -56.066, lines: ["D1", "G"] },
  ];
  const q = query.toLowerCase();
  return all.filter((s) =>
    s.stopName.toLowerCase().includes(q) || s.stopCode.includes(q)
  );
}
