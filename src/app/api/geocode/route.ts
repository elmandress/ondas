/**
 * Endpoint de búsqueda de lugares (SRS FR-3).
 *
 * Estrategia en cascada:
 *   1. POIs curados locales (mvd-pois.json) — match instantáneo, sin red
 *   2. Nominatim con bias geográfico FUERTE a Montevideo (bounded=1)
 *
 * SRS FR-3.3: resultados acotados a Montevideo y área metropolitana.
 * No devolvemos lugares fuera de Uruguay.
 */
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { searchPois, getIconForCategory, type ScoredPoi } from "@/lib/poi-search";
import { tryResolveIntersection } from "@/lib/intersection-search";
import { dedupePlaces } from "@/lib/place-dedup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Índice de ciudades del INTERIOR (geocodificadas en build, fuera del bbox MVD).
// Va antes de Nominatim: "Punta del Este" debe resolver a Maldonado, NO a una calle
// homónima de Montevideo (Nominatim con bounded=1 nunca la encontraría).
interface InteriorCity { name: string; depto: string; lat: number; lon: number }
let _interiorCities: Record<string, InteriorCity> | null = null;
function getInteriorCities(): Record<string, InteriorCity> {
  if (_interiorCities) return _interiorCities;
  try {
    _interiorCities = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public", "interior-cities.json"), "utf-8"));
  } catch { _interiorCities = {}; }
  return _interiorCities!;
}
function normCity(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}
function matchInteriorCity(q: string): InteriorCity | null {
  const nq = normCity(q);
  if (nq.length < 3) return null;
  const cities = getInteriorCities();
  // exacto primero, luego "empieza con" (evita que "san" matchee cualquier cosa)
  for (const c of Object.values(cities)) if (normCity(c.name) === nq) return c;
  for (const c of Object.values(cities)) {
    const n = normCity(c.name);
    if (n.startsWith(nq) && nq.length >= 4) return c;
    if (nq.startsWith(n) && n.length >= 4) return c;
  }
  return null;
}

// Bounding box Montevideo + Canelones cercano (área metropolitana)
const VIEWBOX = "-56.45,-34.55,-55.85,-34.95"; // left,top,right,bottom
const COUNTRY = "uy";

interface GeoResult {
  id: string | number;
  name: string;
  fullName: string;
  lat: number;
  lon: number;
  type: string;
  class?: string;
  icon: string;
  source: "curated" | "nominatim";
  score?: number;
}

/** Forma parcial de un item de respuesta de Nominatim (solo los campos que usamos). */
interface NominatimItem {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  class: string;
  name?: string;
  address?: {
    amenity?: string; shop?: string; tourism?: string; leisure?: string;
    building?: string; office?: string; name?: string;
    road?: string; pedestrian?: string; footway?: string;
    house_number?: string;
    neighbourhood?: string; suburb?: string; city_district?: string; quarter?: string;
  };
}

function poiToResult(p: ScoredPoi): GeoResult {
  return {
    id: p.id,
    name: p.name,
    fullName: p.address ? `${p.name}, ${p.address}, Montevideo` : `${p.name}, Montevideo`,
    lat: p.lat,
    lon: p.lon,
    type: p.category,
    class: p.category,
    icon: getIconForCategory(p.category),
    source: "curated",
    score: p.score,
  };
}

async function fetchNominatim(q: string): Promise<GeoResult[]> {
  const params = new URLSearchParams({
    format: "json",
    q,
    countrycodes: COUNTRY,
    limit: "5",
    "accept-language": "es",
    addressdetails: "1",
    dedupe: "1",
    viewbox: VIEWBOX,
    bounded: "1", // CRÍTICO: forzar resultados dentro del viewbox (no Bolivia, no Argentina)
  });

  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: {
        "User-Agent": "OndasMVD/1.0 (transporte-montevideo@ondas.uy)",
        Accept: "application/json",
      },
      next: { revalidate: 300 },
      // Sin timeout, si Nominatim cuelga la búsqueda de lugares se queda esperando para
      // siempre (hasta el límite de la función). 6s y degradamos a los POIs curados.
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const data = await res.json();

    return (Array.isArray(data) ? data : []).map((item: NominatimItem) => {
      const a = item.address || {};
      const primary =
        a.amenity || a.shop || a.tourism || a.leisure ||
        a.building || a.office || a.name || item.name;
      const street = a.road || a.pedestrian || a.footway;
      const number = a.house_number ? ` ${a.house_number}` : "";
      const area = a.neighbourhood || a.suburb || a.city_district || a.quarter || "";

      // No repetir el barrio cuando coincide con el nombre ("Tres Cruces, Tres Cruces")
      const areaDistinct = area && area.toLowerCase() !== (primary || "").toLowerCase() ? area : "";
      const displayName = primary && primary.length > 2
        ? (areaDistinct ? `${primary}, ${areaDistinct}` : primary)
        : street
        ? `${street}${number}${area ? `, ${area}` : ""}`
        : item.display_name.split(",").slice(0, 2).join(",").trim();

      return {
        id: item.place_id,
        name: displayName,
        fullName: item.display_name,
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
        type: item.type,
        class: item.class,
        icon: iconForOsmClass(item.class, item.type),
        source: "nominatim" as const,
      };
    });
  } catch {
    return [];
  }
}

function iconForOsmClass(cls: string, type: string): string {
  if (cls === "amenity") {
    if (type === "hospital" || type === "clinic") return "🏥";
    if (type === "school" || type === "university" || type === "college") return "🎓";
    if (type === "restaurant" || type === "cafe" || type === "fast_food") return "🍽️";
    if (type === "pharmacy") return "💊";
    if (type === "bank") return "🏦";
    if (type === "bus_station") return "🚌";
    if (type === "fuel") return "⛽";
    if (type === "theatre") return "🎭";
    if (type === "cinema") return "🎬";
    return "📍";
  }
  if (cls === "shop") return type === "mall" ? "🛍️" : "🏪";
  if (cls === "tourism") return type === "museum" ? "🏛️" : "🗺️";
  if (cls === "leisure") return type === "stadium" ? "🏟️" : "🌳";
  if (cls === "place") return "📌";
  if (cls === "highway") return "🛣️";
  return "📍";
}

export async function GET(req: NextRequest) {
  // ── REVERSE geocode: lat/lon → dirección (para "fijar punto en el mapa", FR-4.1).
  // Feedback instantáneo: el cliente ya muestra el marcador; esto le pone nombre.
  const latP = req.nextUrl.searchParams.get("lat");
  const lonP = req.nextUrl.searchParams.get("lon");
  if (latP && lonP) {
    const lat = Number(latP), lon = Number(lonP);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return NextResponse.json({ error: "lat/lon inválidos" }, { status: 400 });
    }
    try {
      const params = new URLSearchParams({
        format: "jsonv2", lat: String(lat), lon: String(lon), zoom: "18", addressdetails: "1",
      });
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
        headers: { "User-Agent": "OndasMVD/1.0 (transporte-montevideo@ondas.uy)" },
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { display_name?: string; address?: Record<string, string>; name?: string };
      const a = data.address || {};
      const road = a.road || a.pedestrian || a.footway || a.neighbourhood;
      const num = a.house_number;
      const name = data.name || (road ? (num ? `${road} ${num}` : road) : null) || "Punto en el mapa";
      return NextResponse.json(
        { name, fullName: data.display_name || name, lat, lon },
        { headers: { "Cache-Control": "public, s-maxage=86400" } },
      );
    } catch {
      return NextResponse.json({ name: "Punto en el mapa", fullName: null, lat, lon });
    }
  }

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 1 || q.length > 300) {
    return NextResponse.json({ results: [] });
  }

  // 0a. CIUDAD DEL INTERIOR (Punta del Este, Salto, Colonia…). Va primero porque el
  // bbox de MVD haría que Nominatim devuelva una calle homónima local. Resolvemos a la
  // ciudad real (fuera del bbox) → la app la trata como viaje interdepartamental.
  const city = matchInteriorCity(q);
  if (city) {
    const cityResult: GeoResult = {
      id: `city:${city.name}`,
      name: city.name,
      fullName: `${city.name}, ${city.depto}, Uruguay`,
      lat: city.lat, lon: city.lon,
      type: "city", class: "place", icon: "🏙️", source: "curated",
    };
    // Igual ofrecemos POIs locales por si el usuario quería algo en MVD con ese nombre.
    const extras = searchPois(q, 3).map(poiToResult);
    return NextResponse.json(
      { results: [cityResult, ...extras].slice(0, 5) },
      { headers: { "Cache-Control": "public, s-maxage=3600" } },
    );
  }

  // 0. ESQUINAS (intersecciones) — feature MUY usado en Uruguay.
  // Si el query es "Amezaga y Justicia", "Garibaldi esq Rivadavia", etc.,
  // resolvemos contra la API oficial IDE y devolvemos coords exactas.
  // Va PRIMERO porque cuando el usuario escribe esto, no hay ambigüedad.
  const intersection = await tryResolveIntersection(q);
  if (intersection) {
    const result: GeoResult = {
      id: `esq:${intersection.lat},${intersection.lon}`,
      name: intersection.name,
      fullName: intersection.fullAddress,
      lat: intersection.lat,
      lon: intersection.lon,
      type: "intersection",
      class: "intersection",
      icon: "🛣️",
      source: "curated",
    };
    // Devolvemos la esquina al inicio + completamos con POIs/Nominatim por si acaso
    const curatedExtras = searchPois(q, 3).map(poiToResult);
    return NextResponse.json(
      { results: [result, ...curatedExtras].slice(0, 5) },
      { headers: { "Cache-Control": "public, s-maxage=3600" } }
    );
  }

  // 1. POIs curados (instantáneo, sin red)
  const curatedRaw = searchPois(q, 8).map(poiToResult);

  // Dedupe curados: mismo punto (<55m) o mismo nombre normalizado a <300m
  // (lib/place-dedup — el dedup solo-proximidad dejaba pasar el mismo lugar con
  // coords distintas, ej. terminal vs centroide OSM del edificio).
  const curated = dedupePlaces([], curatedRaw).slice(0, 6);

  // Detectar si el query parece dirección (números o palabras de vía)
  const looksLikeAddress = /\b\d{2,4}\b|\b(calle|avenida|av|bulevar|bvar|rambla|paso|camino|ruta|km)\b/i.test(q);

  // Si tenemos matches MUY buenos (score >= 110) Y no parece dirección, no llamamos a Nominatim.
  // Score 110 = match exacto (100) + boost mínimo de categoría (10).
  const strongCurated = curated.filter((r) => (r.score || 0) >= 110);
  const callNominatim = looksLikeAddress || strongCurated.length < 2;

  let combined: GeoResult[];
  if (!callNominatim) {
    combined = curated;
  } else {
    const nominatim = await fetchNominatim(q);
    // Dedupe contra los curados: mismo punto O mismo nombre cercano. Arregla el
    // caso visible "Shopping Tres Cruces" + "Tres Cruces Shopping" juntos.
    const nominatimFiltered = dedupePlaces(curated, nominatim);
    // Si parece dirección, las direcciones de Nominatim van PRIMERO
    combined = looksLikeAddress ? [...nominatimFiltered, ...curated] : [...curated, ...nominatimFiltered];
  }

  // Limpiar score del payload final (no se expone al cliente)
  const final = combined.slice(0, 7).map((r) => {
    const rest = { ...r };
    delete rest.score;
    return rest;
  });

  return NextResponse.json(
    { results: final },
    { headers: { "Cache-Control": "public, s-maxage=300" } }
  );
}
