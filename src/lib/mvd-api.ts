/**
 * Cliente para la API oficial autenticada de Montevideo (api.montevideo.gub.uy).
 *
 * Auth: OAuth2 client_credentials flow.
 *   1. POST {tokenUrl} con client_id + client_secret → access_token (300s)
 *   2. Usar Bearer token en todos los endpoints de /api/transportepublico/*
 *
 * Server-only: NO importar desde código cliente (las credenciales no deben salir del server).
 *
 * Cache: el token se cachea en memoria del proceso server hasta 30s antes de expirar.
 * Como Next.js puede reciclar el proceso, el cache es best-effort.
 */


const TOKEN_URL = process.env.MVD_API_TOKEN_URL || "https://mvdapi-auth.montevideo.gub.uy/token";
const API_BASE = process.env.MVD_API_BASE || "https://api.montevideo.gub.uy/api/transportepublico";
const CLIENT_ID = process.env.MVD_API_CLIENT_ID;
const CLIENT_SECRET = process.env.MVD_API_CLIENT_SECRET;

interface TokenCache { accessToken: string; expiresAt: number; }
let cached: TokenCache | null = null;

export function isMvdApiConfigured(): boolean {
  return !!(CLIENT_ID && CLIENT_SECRET);
}

/**
 * Obtiene un access token válido (cacheado).
 * Si no hay credenciales o falla la auth, devuelve null para que el caller haga fallback.
 */
async function getAccessToken(): Promise<string | null> {
  if (!CLIENT_ID || !CLIENT_SECRET) return null;

  const now = Date.now();
  // Reusar token cacheado si vence en más de 30s
  if (cached && cached.expiresAt - now > 30_000) {
    return cached.accessToken;
  }

  try {
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    });

    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(3000), // R67: 4s→3s — acota la cadena serial del arrivals
    });

    if (!res.ok) {
      console.error("[mvd-api] token request failed:", res.status);
      return null;
    }

    const data = (await res.json()) as { access_token: string; expires_in: number };
    if (!data.access_token) return null;

    cached = {
      accessToken: data.access_token,
      expiresAt: now + data.expires_in * 1000,
    };
    return cached.accessToken;
  } catch (err) {
    console.error("[mvd-api] token request error:", err);
    return null;
  }
}

interface FetchOptions {
  /** Si true, lanza error en lugar de devolver null. Default false. */
  throwOnError?: boolean;
  /** Si true, parsea como JSON. Si false, devuelve Response cruda (para descargas binarias). */
  json?: boolean;
}

/**
 * Hace una llamada GET autenticada a la API de transporte público.
 * Devuelve los datos parseados (default JSON) o null si falla.
 */
export async function mvdApiGet<T = unknown>(
  path: string,
  options: FetchOptions = {}
): Promise<T | null> {
  const token = await getAccessToken();
  if (!token) return null;

  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(4500), // R67: 6s→4.5s — acota la cadena serial del arrivals bajo el límite de Netlify
    });

    if (!res.ok) {
      if (options.throwOnError) throw new Error(`mvd-api ${res.status} ${url}`);
      return null;
    }

    if (options.json === false) return res as unknown as T;
    return (await res.json()) as T;
  } catch (err) {
    if (options.throwOnError) throw err;
    console.error("[mvd-api] fetch error:", err);
    return null;
  }
}

// ─────────────────────────────────────────────
// Tipos y wrappers semánticos para endpoints conocidos
// ─────────────────────────────────────────────

/** Bus del sistema con metadata enriquecida vs stm-online viejo */
export interface MvdBus {
  eType: "buses";
  company: string;          // "CUTCSA", "COETC", etc.
  timestamp: string;
  busId: number;
  line: string;             // número comercial ("76")
  lineVariantId: number;    // variante interna
  location: { type: "Point"; coordinates: [number, number] }; // [lon, lat]
  origin: string;
  destination: string;
  subline: string;
  special: boolean;
  speed: number;
  /** SRS FR-6.3: accesibilidad REAL por bus (no inventada) */
  access: "PISO BAJO" | "PISO ALTO" | string;
  thermalConfort: "Aire Acondicionado" | string;
  emissions: string;        // "Euro V", etc.
}

/**
 * Buses del sistema con datos enriquecidos (accesibilidad, AC, emisiones).
 * IMPORTANTE: el parámetro de query es `lines` (en inglés), NO `lineas`.
 *
 * Opciones útiles:
 *   - `lines`: filtrar por líneas comerciales
 *   - `busstopId`: SOLO devuelve buses upstream a esa parada — filtro oficial STM,
 *     sin necesidad de proyectar GPS sobre polyline.
 */
export async function getBuses(opts: {
  lines?: string[];
  busstopId?: string | number;
  company?: string;
} = {}): Promise<MvdBus[]> {
  const params = new URLSearchParams();
  if (opts.lines && opts.lines.length) params.set("lines", opts.lines.join(","));
  if (opts.busstopId != null) params.set("busstopId", String(opts.busstopId));
  if (opts.company) params.set("company", opts.company);
  const qs = params.toString();
  const data = await mvdApiGet<MvdBus[]>(`/buses${qs ? "?" + qs : ""}`);
  return Array.isArray(data) ? data : [];
}

/**
 * Próximos buses a una parada — REEMPLAZO OFICIAL de nextETA viejo.
 * Devuelve buses que van HACIA la parada con ETA en segundos y datos enriquecidos.
 *
 * IMPORTANTE: el parámetro es `lines` (en inglés), no `lineas`.
 */
export interface MvdUpcomingBus {
  busId: number;
  companyName: string;
  lineVariantId: number;
  line: string;             // número comercial ("76")
  origin: string;
  destination: string;
  subline: string;
  special: boolean;
  /** Segundos hasta llegar a la parada */
  eta: number;
  /** Metros restantes en el recorrido (no haversine) */
  distance: number;
  /** Posición ordinal del bus en el recorrido */
  position: number;
  access: "PISO BAJO" | "PISO ALTO" | "PLATAFORMA ELEVADORA" | "COMÚN" | string;
  thermalConfort: string;
  emissions: string;
  location: { type: "Point"; coordinates: [number, number] };
}

export async function getUpcomingBuses(
  busstopId: number | string,
  lines: string[],
  amountPerLine = 3
): Promise<MvdUpcomingBus[]> {
  if (!lines.length) return [];
  const params = new URLSearchParams({
    lines: lines.join(","),
    amountperline: String(amountPerLine),
  });
  const data = await mvdApiGet<MvdUpcomingBus[]>(
    `/buses/busstops/${busstopId}/upcomingbuses?${params}`
  );
  return Array.isArray(data) ? data : [];
}

/** Variantes de línea (recorrido + paradas) */
export async function getLineVariants(): Promise<unknown[]> {
  const data = await mvdApiGet<unknown[]>("/buses/linevariants");
  return Array.isArray(data) ? data : [];
}

/**
 * Descarga el GTFS estático oficial. Devuelve la URL firmada / response cruda
 * para guardarlo a disco (no parsear como JSON).
 *
 * Uso típico en script de bootstrap, no en cada request.
 */
export async function downloadGtfsZip(): Promise<Response | null> {
  const res = await mvdApiGet<Response>("/buses/gtfs/static/latest/google_transit.zip", {
    json: false,
  });
  return res;
}

/** Versión actual del GTFS publicado (string corta tipo "20260525") */
export async function getGtfsVersion(): Promise<string | null> {
  const token = await getAccessToken();
  if (!token) return null;
  try {
    const res = await fetch(`${API_BASE}/buses/gtfs/static/latest/version.txt`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    return (await res.text()).trim();
  } catch {
    return null;
  }
}
