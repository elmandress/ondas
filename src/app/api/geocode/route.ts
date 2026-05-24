import { NextRequest, NextResponse } from "next/server";

// Proxy para Nominatim OSM — evita CORS y permite añadir headers correctos
// Términos de uso: máx 1 req/s, User-Agent obligatorio
// https://nominatim.org/release-docs/develop/api/Search/

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ results: [] });

  try {
    const params = new URLSearchParams({
      format: "json",
      q: `${q} Montevideo Uruguay`,
      countrycodes: "uy",
      limit: "6",
      "accept-language": "es",
      addressdetails: "1",
      dedupe: "1",
    });

    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?${params.toString()}`,
      {
        headers: {
          "User-Agent": "OndasMVD/1.0 (app de transporte Montevideo)",
          Accept: "application/json",
        },
        next: { revalidate: 300 },
      }
    );

    if (!res.ok) return NextResponse.json({ results: [] });

    const data = await res.json();

    // Normalizar respuesta
    const results = (Array.isArray(data) ? data : []).map((item: any) => ({
      id: item.place_id,
      name: buildShortName(item),
      fullName: item.display_name,
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon),
      type: item.type,
      class: item.class,
      address: item.address || {},
    }));

    return NextResponse.json(
      { results },
      { headers: { "Cache-Control": "public, s-maxage=300" } }
    );
  } catch {
    return NextResponse.json({ results: [] });
  }
}

function buildShortName(item: any): string {
  const a = item.address || {};

  // Priorizar nombre de lugar conocido
  const primary =
    a.amenity ||
    a.shop ||
    a.tourism ||
    a.leisure ||
    a.building ||
    a.office ||
    a.name ||
    item.name;

  if (primary && primary.length > 2) {
    const neighborhood = a.neighbourhood || a.suburb || a.quarter || "";
    return neighborhood ? `${primary}, ${neighborhood}` : primary;
  }

  // Fallback: calle + barrio
  const street = a.road || a.pedestrian || a.footway || "";
  const number = a.house_number ? ` ${a.house_number}` : "";
  const area = a.neighbourhood || a.suburb || a.city_district || a.quarter || "";

  if (street) return `${street}${number}${area ? ", " + area : ""}`;

  // Último recurso: primeras dos partes del display_name
  return item.display_name.split(",").slice(0, 2).join(",").trim();
}
