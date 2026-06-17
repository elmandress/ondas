/**
 * GET /api/gps/interior?zona=maldonado
 * GPS EN VIVO del interior. La API de Montevideo NO cubre el interior; estas
 * intendencias/empresas exponen su tracking públicamente (sistema Busmatick).
 * Proxeamos server-side (muchas fuentes son http/puerto raro → mixed-content en el
 * browser) y normalizamos a JSON. Soporta dos formatos: XML <marker> y GeoJSON.
 *
 * Honesto: posición REAL del bus (en vivo). Cada zona es una fuente distinta; si una
 * cae, devolvemos vacío sin romper.
 */
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Fmt = "xml" | "geojson";
// Fuentes verificadas funcionando (ver memoria reference-gps-interior-busmatick).
const SOURCES: Record<string, { url: string; label: string; fmt: Fmt }> = {
  maldonado: { url: "http://ip.codesa.com.uy/pub/avl.xml", label: "Maldonado (CODESA)", fmt: "xml" },
  sancarlos: { url: "http://solantigua.ddns.net:2780/pub/avl.xml", label: "San Carlos (Sol Antigua)", fmt: "xml" },
  paysandu: { url: "https://bus.copay.com.uy:10443/pub/avl.xml", label: "Paysandú (COPAY)", fmt: "xml" },
  rocha: { url: "https://sig.rocha.gub.uy/leaflet/json/avl.geojson", label: "Rocha (IM Rocha)", fmt: "geojson" },
};

export interface InteriorBus {
  lat: number; lon: number;
  bus: string;          // nº de coche
  line: string;         // nº de línea
  lineName: string;     // nombre/destino
  speed: number;        // km/h
  heading: number;      // rumbo
  hora: string;         // HH:MM:SS del reporte
  nextStop?: string;    // próxima parada (nombre)
  nextStopCode?: string;// próxima parada (código p1c) — para cruzar con paradas inferidas
  nextNextStopCode?: string; // parada siguiente a la próxima (p2c) — sanity de sentido
  dir?: string;         // sentido (sen) — elige el subgrafo dirigido de interior-edges
  delayMin?: number;    // regularidad (+tarde / -adelantado)
  occupancy?: number;   // pasajeros a bordo (si lo reporta)
}

function tag(block: string, t: string): string {
  const m = block.match(new RegExp(`<${t}>([^<]*)</${t}>`, "i"));
  return m ? m[1].trim() : "";
}

// Campos Busmatick comunes a XML y GeoJSON: lat/lon, bus, lin, lnm, vel, rum, hor,
// p1n (próx parada), reg (atraso min), psj (pasajeros).
function fromProps(lat: number, lon: number, p: Record<string, unknown>): InteriorBus | null {
  if (!isFinite(lat) || !isFinite(lon)) return null;
  const num = (k: string) => { const n = parseInt(String(p[k] ?? ""), 10); return isFinite(n) ? n : undefined; };
  return {
    lat, lon,
    bus: String(p.bus ?? ""),
    line: String(p.lin ?? ""),
    lineName: String(p.lnm ?? ""),
    speed: num("vel") ?? 0,
    heading: num("rum") ?? 0,
    hora: String(p.hor ?? ""),
    nextStop: p.p1n ? String(p.p1n) : undefined,
    nextStopCode: p.p1c ? String(p.p1c) : undefined,
    nextNextStopCode: p.p2c ? String(p.p2c) : undefined,
    dir: p.sen ? String(p.sen) : undefined,
    delayMin: num("reg"),
    occupancy: num("psj"),
  };
}

function parseXml(xml: string): InteriorBus[] {
  const out: InteriorBus[] = [];
  for (const m of xml.match(/<marker>[\s\S]*?<\/marker>/gi) || []) {
    const props: Record<string, string> = {};
    for (const f of ["bus", "lin", "lnm", "vel", "rum", "hor", "p1n", "p1c", "p2c", "sen", "reg", "psj"]) props[f] = tag(m, f);
    const b = fromProps(parseFloat(tag(m, "lat")), parseFloat(tag(m, "lon")), props);
    if (b) out.push(b);
  }
  return out;
}

function parseGeoJson(text: string): InteriorBus[] {
  const out: InteriorBus[] = [];
  try {
    const j = JSON.parse(text) as { features?: { geometry?: { coordinates?: [number, number] }; properties?: Record<string, unknown> }[] };
    for (const f of j.features || []) {
      const c = f.geometry?.coordinates;
      if (!c) continue;
      const b = fromProps(c[1], c[0], f.properties || {}); // GeoJSON = [lon,lat]
      if (b) out.push(b);
    }
  } catch { /* feed roto → vacío */ }
  return out;
}

export async function GET(req: NextRequest) {
  const zona = (req.nextUrl.searchParams.get("zona") || "maldonado").toLowerCase();
  const src = SOURCES[zona];
  if (!src) return NextResponse.json({ error: "zona desconocida", zonas: Object.keys(SOURCES) }, { status: 400 });

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(`${src.url}?noCache=${Date.now()}`, { signal: ctrl.signal, cache: "no-store" });
    clearTimeout(t);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const buf = await res.arrayBuffer();
    // Busmatick XML es latin1; el GeoJSON de Rocha es utf-8.
    const text = new TextDecoder(src.fmt === "geojson" ? "utf-8" : "iso-8859-1").decode(buf);
    const buses = src.fmt === "geojson" ? parseGeoJson(text) : parseXml(text);

    return NextResponse.json(
      { zona, label: src.label, count: buses.length, buses, live: true },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch {
    return NextResponse.json(
      { zona, label: src.label, count: 0, buses: [], live: true, unavailable: true },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
}
