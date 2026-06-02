/**
 * Empresa operadora por línea + datos de contacto y WiFi a bordo.
 *
 * Fuentes (ver scripts/build-operators.mjs):
 *  - operators.json byLine: líneas metropolitanas (GTFS agency oficial: COPSA, UCOT…).
 *  - operators.json byCompany: catálogo de empresas de MVD con su web.
 *  - companyName en vivo (API): para líneas urbanas de MVD, la empresa real del bus.
 *
 * Honestidad: el WiFi NO tiene "contraseña" pública. CUTCSA hoy usa la app "VAMOS"
 * (conexión automática, sin clave). No inventamos red/clave; informamos lo real.
 */

export interface OperatorInfo {
  empresa: string;
  web?: string;
  /** Cómo conectarse al WiFi a bordo, si la empresa lo ofrece (dato real, sin clave). */
  wifi?: { red: string; via: string; appUrl?: string };
}

interface OperatorsData {
  byLine: Record<string, { empresa: string; web: string }>;
  byCompany: Record<string, { empresa: string; web: string }>;
}

let _cache: OperatorsData | null = null;
let _promise: Promise<OperatorsData> | null = null;

export function loadOperators(): Promise<OperatorsData> {
  if (_cache) return Promise.resolve(_cache);
  if (_promise) return _promise;
  _promise = fetch("/operators.json")
    .then((r) => r.json())
    .then((d: OperatorsData) => { _cache = d; _promise = null; return d; })
    .catch(() => { _promise = null; return { byLine: {}, byCompany: {} }; });
  return _promise;
}

// WiFi a bordo CONFIRMADO (dato real investigado):
//  - CUTCSA: red "VAMOS CUTCSA", se conecta con la app VAMOS (sin contraseña).
// Solo lo afirmamos donde está verificado. No inventamos para otras empresas.
const WIFI_BY_COMPANY: Record<string, OperatorInfo["wifi"]> = {
  CUTCSA: { red: "VAMOS CUTCSA", via: "Se conecta con la app VAMOS (gratis, sin contraseña)", appUrl: "https://www.vamosbus.com.uy/" },
};

/**
 * Resuelve la empresa de una línea. `liveCompany` (de la API en vivo) tiene
 * prioridad para líneas urbanas de MVD; si no, usamos el mapeo metro estático.
 */
export function resolveOperator(
  data: OperatorsData,
  lineName: string,
  liveCompany?: string,
): OperatorInfo | null {
  const line = (lineName || "").trim();

  // 1. Empresa en vivo (API) → buscar su contacto en el catálogo.
  if (liveCompany) {
    const key = liveCompany.trim().toUpperCase();
    const cat = data.byCompany[key];
    const info: OperatorInfo = { empresa: cat?.empresa || liveCompany, web: cat?.web };
    info.wifi = WIFI_BY_COMPANY[key];
    return info;
  }

  // 2. Línea metropolitana con agency conocido.
  const metro = data.byLine[line];
  if (metro) {
    const key = metro.empresa.trim().toUpperCase();
    return { empresa: metro.empresa, web: metro.web, wifi: WIFI_BY_COMPANY[key] };
  }

  return null;
}
