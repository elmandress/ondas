/**
 * GET /api/walking?from=lat,lon&to=lat,lon
 *
 * Proxy a OSRM público para calcular trayecto peatonal real (calles, no haversine).
 * SRS FR-4.9: tramos peatonales con calles reales.
 *
 * Respuesta:
 *   {
 *     ok: true,
 *     distanceM: 240,
 *     durationS: 180,
 *     steps: [{distanceM: 60, durationS: 50, name: "Av. Garibaldi", instruction: "Caminá por Av. Garibaldi"}]
 *   }
 *
 * Si OSRM no responde en 2s, devolvemos fallback haversine para no romper la UI.
 */
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OSRM_URL = process.env.OSRM_URL || "https://router.project-osrm.org";
const TIMEOUT_MS = 2500;

// Velocidad caminata para fallback haversine (4.5 km/h)
const WALK_SPEED_MS = 1.25;

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function parseLatLon(s: string | null): [number, number] | null {
  if (!s) return null;
  const parts = s.split(",").map((x) => Number(x.trim()));
  if (parts.length !== 2 || parts.some((n) => !Number.isFinite(n))) return null;
  return [parts[0], parts[1]];
}

interface WalkStep { distanceM: number; durationS: number; name: string; instruction: string; }
interface WalkResult { ok: boolean; distanceM: number; durationS: number; steps: WalkStep[]; source: "osrm" | "fallback"; }

type OsrmStep = { distance: number; name: string };
type OsrmRoute = { distance: number; legs?: { steps?: OsrmStep[] }[] };
type OsrmResp = { code: string; routes?: OsrmRoute[] };

async function fetchOsrm(from: [number, number], to: [number, number], signal: AbortSignal): Promise<OsrmRoute | null> {
  // perfil `walking` (más permisivo con oneway que `foot`)
  const url = `${OSRM_URL}/route/v1/walking/${from[1]},${from[0]};${to[1]},${to[0]}?steps=true&overview=false`;
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const data = (await res.json()) as OsrmResp;
    if (data.code !== "Ok" || !data.routes?.length) return null;
    return data.routes[0];
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const from = parseLatLon(req.nextUrl.searchParams.get("from"));
  const to = parseLatLon(req.nextUrl.searchParams.get("to"));
  if (!from || !to) {
    return NextResponse.json({ error: "from y to requeridos como 'lat,lon'" }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    // Bidi: pedimos A→B y B→A en paralelo. Para peatones no existen sentidos,
    // así que la opción MÁS CORTA es la correcta — si una dirección "da la
    // vuelta a la manzana" por oneway, la otra suele ir directo.
    const [forward, reverse] = await Promise.all([
      fetchOsrm(from, to, controller.signal),
      fetchOsrm(to, from, controller.signal),
    ]);
    clearTimeout(timer);

    const candidates = [forward, reverse].filter((r): r is OsrmRoute => !!r);
    if (!candidates.length) return jsonFallback(from, to);

    const route = candidates.reduce((best, r) => (r.distance < best.distance ? r : best));

    // OSRM tiene velocidad demasiado optimista; recalculamos por paso humano real (4.5 km/h)
    const correctedDurationS = Math.round(route.distance / WALK_SPEED_MS);

    const steps: WalkStep[] = (route.legs?.[0]?.steps || [])
      .map((s: OsrmStep) => {
        const name = s.name || "";
        const distanceM = Math.round(s.distance);
        const durationS = Math.round(s.distance / WALK_SPEED_MS);
        const instruction = name ? `Caminá ${distanceM}m por ${name}` : `Caminá ${distanceM}m`;
        return { distanceM, durationS, name, instruction };
      })
      .filter((s: WalkStep) => s.distanceM >= 10);

    return NextResponse.json(
      {
        ok: true,
        distanceM: Math.round(route.distance),
        durationS: correctedDurationS,
        steps,
        source: "osrm",
      } satisfies WalkResult,
      { headers: { "Cache-Control": "public, s-maxage=86400" } }
    );
  } catch {
    return jsonFallback(from, to);
  }
}

function jsonFallback(from: [number, number], to: [number, number]): NextResponse {
  // Fallback haversine cuando OSRM no responde o falla
  const d = haversineM(from[0], from[1], to[0], to[1]);
  const haversineDist = Math.round(d * 1.25); // factor 1.25 para aproximar distancia real por calles
  const durationS = Math.round(haversineDist / WALK_SPEED_MS);
  return NextResponse.json({
    ok: true,
    distanceM: haversineDist,
    durationS,
    steps: [{
      distanceM: haversineDist,
      durationS,
      name: "",
      instruction: `Caminá ${haversineDist}m`,
    }],
    source: "fallback",
  } satisfies WalkResult);
}
