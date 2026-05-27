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
import { searchPois, getIconForCategory, type ScoredPoi } from "@/lib/poi-search";
import { tryResolveIntersection } from "@/lib/intersection-search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    });
    if (!res.ok) return [];
    const data = await res.json();

    return (Array.isArray(data) ? data : []).map((item: any) => {
      const a = item.address || {};
      const primary =
        a.amenity || a.shop || a.tourism || a.leisure ||
        a.building || a.office || a.name || item.name;
      const street = a.road || a.pedestrian || a.footway;
      const number = a.house_number ? ` ${a.house_number}` : "";
      const area = a.neighbourhood || a.suburb || a.city_district || a.quarter || "";

      const displayName = primary && primary.length > 2
        ? (area ? `${primary}, ${area}` : primary)
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
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 1) {
    return NextResponse.json({ results: [] });
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

  // Dedupe curados por proximidad (≈ <50m) — eliminamos POIs OSM duplicados
  // y el hand-curated cuando hay un OSM equivalente cercano.
  const curated: GeoResult[] = [];
  for (const c of curatedRaw) {
    const dup = curated.find(
      (e) => Math.abs(e.lat - c.lat) < 0.0005 && Math.abs(e.lon - c.lon) < 0.0005
    );
    if (!dup) curated.push(c);
    if (curated.length >= 6) break;
  }

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
    // Dedupe por proximidad (mismo lugar ≈ <50m)
    const seen: Array<{ lat: number; lon: number }> = curated.map((c) => ({ lat: c.lat, lon: c.lon }));
    const nominatimFiltered = nominatim.filter((n) => {
      return !seen.some((s) => Math.abs(s.lat - n.lat) < 0.0005 && Math.abs(s.lon - n.lon) < 0.0005);
    });
    // Si parece dirección, las direcciones de Nominatim van PRIMERO
    combined = looksLikeAddress ? [...nominatimFiltered, ...curated] : [...curated, ...nominatimFiltered];
  }

  // Limpiar score del payload final (no se expone al cliente)
  const final = combined.slice(0, 7).map(({ score: _score, ...rest }) => rest);

  return NextResponse.json(
    { results: final },
    { headers: { "Cache-Control": "public, s-maxage=300" } }
  );
}
