/**
 * Planificador de rutas estilo Google Maps / Citymapper para Montevideo.
 *
 * Genera 3 tipos de opciones según el caso:
 *   - "walk":     ir caminando (si distancia <2.5km)
 *   - "direct":   caminar a parada A → tomar bus → bajar en parada B → caminar al destino
 *   - "transfer": caminar → bus 1 → caminar a otra parada → bus 2 → caminar
 *
 * IMPORTANTE: las líneas vienen del shapefile (algunos números antiguos).
 * Para matching parada↔parada esto es CONSISTENTE — si dos paradas tienen "147",
 * un bus que va de una a otra realmente existe. El número que se muestra puede
 * ser viejo pero la conexión es real.
 */
import type { StopRecord } from "@/lib/stops-dataset";

export interface RouteCandidate {
  type: "walk" | "direct" | "transfer";
  fromStop?: StopRecord;
  toStop?: StopRecord;
  sharedLines: string[]; // líneas que sirven (en el caso "direct")
  // For transfers
  transferStop?: StopRecord;
  transferLine1?: string;
  transferLine2?: string;
  // Distancias en metros
  walkFromMeters: number; // caminata desde origen
  walkToMeters: number; // caminata al destino
  walkTransferMeters?: number; // caminata entre paradas de transbordo (si aplica)
  // Estimación de tiempo total en minutos
  estimatedMinutes: number;
}

const WALK_SPEED_MS = 1.25; // 4.5 km/h
const BUS_AVG_SPEED_MS = 6.5; // ~23 km/h promedio urbano con paradas
const BUS_WAIT_MIN = 6; // espera promedio en parada
const TRANSFER_PENALTY_MIN = 7; // espera + caminata entre paradas

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function walkMinutes(meters: number): number {
  return Math.ceil(meters / (WALK_SPEED_MS * 60));
}

function busMinutes(meters: number): number {
  return Math.ceil(meters / (BUS_AVG_SPEED_MS * 60));
}

export function planRoutes(
  stops: StopRecord[],
  origin: { lat: number; lon: number },
  destination: { lat: number; lon: number },
  options: { walkRadiusM?: number; maxCandidates?: number } = {}
): RouteCandidate[] {
  // SRS FR-4: ampliamos el radio walking a 1500m y siempre buscamos transbordos.
  // Antes solo se buscaban transbordos si había <3 directos → para casos como
  // "Punta Carretas → Carrasco" no se encontraban combinaciones porque no hay
  // un solo bus que conecte ambas paradas cercanas.
  const { walkRadiusM = 1500, maxCandidates = 6 } = options;
  const directDist = haversine(origin.lat, origin.lon, destination.lat, destination.lon);

  const candidates: RouteCandidate[] = [];

  // ── Paradas cercanas al origen y destino ──
  const fromStops = stops
    .map((s) => ({ s, d: haversine(origin.lat, origin.lon, s.stopLat, s.stopLon) }))
    .filter((x) => x.d <= walkRadiusM)
    .sort((a, b) => a.d - b.d)
    .slice(0, 25);

  const toStops = stops
    .map((s) => ({ s, d: haversine(destination.lat, destination.lon, s.stopLat, s.stopLon) }))
    .filter((x) => x.d <= walkRadiusM)
    .sort((a, b) => a.d - b.d)
    .slice(0, 25);

  // ── OPCIÓN 1: directo (bus único entre fromStop y toStop) ──
  // Va primero porque suele ser la mejor cuando existe.
  for (const f of fromStops) {
    for (const t of toStops) {
      if (f.s.stopId === t.s.stopId) continue;
      const fromLines = new Set(f.s.lines);
      const shared = t.s.lines.filter((l) => fromLines.has(l));
      if (shared.length === 0) continue;

      // FR-4: validar que el bus realmente "acerca" al destino — descartar si la
      // distancia bus parada↔parada es mayor que la distancia origen↔destino × 1.4
      // (el bus está dando una vuelta innecesaria).
      const stopDist = haversine(f.s.stopLat, f.s.stopLon, t.s.stopLat, t.s.stopLon);
      if (stopDist > directDist * 1.4 + 500) continue;

      const estMin =
        walkMinutes(f.d) +
        BUS_WAIT_MIN +
        busMinutes(stopDist) +
        walkMinutes(t.d);

      candidates.push({
        type: "direct",
        fromStop: f.s,
        toStop: t.s,
        sharedLines: shared,
        walkFromMeters: Math.round(f.d),
        walkToMeters: Math.round(t.d),
        estimatedMinutes: estMin,
      });
    }
  }

  // ── OPCIÓN 2: con transbordo (SIEMPRE buscamos, no solo si faltan directos) ──
  // Index: line → stops
  const lineStops = new Map<string, StopRecord[]>();
  for (const s of stops) {
    for (const l of s.lines) {
      if (!lineStops.has(l)) lineStops.set(l, []);
      lineStops.get(l)!.push(s);
    }
  }

  const transferKeys = new Set<string>();
  let transfersFound = 0;
  const MAX_TRANSFERS = 30;
  outer: for (const f of fromStops.slice(0, 10)) {
    for (const t of toStops.slice(0, 10)) {
      if (f.s.stopId === t.s.stopId) continue;
      const fromLines = new Set(f.s.lines);
      const toLines = new Set(t.s.lines);

      for (const l1 of fromLines) {
        if (toLines.has(l1)) continue; // ya es directo
        const midStops = lineStops.get(l1) || [];

        for (const mid of midStops) {
          if (mid.stopId === f.s.stopId || mid.stopId === t.s.stopId) continue;
          // La parada de transbordo tiene que estar "entre" origen y destino
          const dFromOrig = haversine(origin.lat, origin.lon, mid.stopLat, mid.stopLon);
          const dToDest = haversine(destination.lat, destination.lon, mid.stopLat, mid.stopLon);
          if (dFromOrig > directDist * 1.4 + 500 || dToDest > directDist * 1.4 + 500) continue;

          const matches = mid.lines.filter((l) => toLines.has(l) && l !== l1);
          if (matches.length === 0) continue;

          const l2 = matches[0];
          const key = `${l1}-${l2}-${f.s.stopId}-${t.s.stopId}`;
          if (transferKeys.has(key)) continue;
          transferKeys.add(key);

          const busDist1 = haversine(f.s.stopLat, f.s.stopLon, mid.stopLat, mid.stopLon);
          const busDist2 = haversine(mid.stopLat, mid.stopLon, t.s.stopLat, t.s.stopLon);
          const estMin =
            walkMinutes(f.d) +
            BUS_WAIT_MIN +
            busMinutes(busDist1) +
            TRANSFER_PENALTY_MIN +
            busMinutes(busDist2) +
            walkMinutes(t.d);

          candidates.push({
            type: "transfer",
            fromStop: f.s,
            toStop: t.s,
            transferStop: mid,
            transferLine1: l1,
            transferLine2: l2,
            sharedLines: [l1, l2],
            walkFromMeters: Math.round(f.d),
            walkToMeters: Math.round(t.d),
            walkTransferMeters: 0,
            estimatedMinutes: estMin,
          });
          transfersFound++;
          if (transfersFound >= MAX_TRANSFERS) break outer;
        }
      }
    }
  }

  // ── OPCIÓN 3: caminar (como ALTERNATIVA, no primero) ──
  // FR-4.5: caminar es alternativa adicional cuando <2.5km. Antes era siempre primero
  // cuando <3km porque su tiempo (sin penalización de espera) salía menor que cualquier bus.
  // Solo la incluimos si el tiempo no es absurdo (≤30 min ≈ 2.2 km).
  if (directDist <= 2500) {
    const wMin = walkMinutes(directDist);
    if (wMin <= 30) {
      candidates.push({
        type: "walk",
        sharedLines: [],
        walkFromMeters: Math.round(directDist),
        walkToMeters: 0,
        estimatedMinutes: wMin,
      });
    }
  }

  // ── Ordenar por tiempo total estimado ──
  candidates.sort((a, b) => a.estimatedMinutes - b.estimatedMinutes);

  // ── Deduplicar manteniendo el más rápido de cada categoría ──
  const seen = new Set<string>();
  const unique: RouteCandidate[] = [];
  for (const c of candidates) {
    let key: string;
    if (c.type === "walk") key = "walk";
    else if (c.type === "direct") {
      key = `d-${c.fromStop?.stopId}-${c.toStop?.stopId}`;
    } else {
      key = `t-${c.transferLine1}-${c.transferLine2}`;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(c);
    if (unique.length >= maxCandidates) break;
  }

  return unique;
}
