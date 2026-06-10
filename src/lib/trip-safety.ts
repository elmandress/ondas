/**
 * trip-safety.ts — Motor de RECOMENDACIÓN de seguridad CONTEXTUAL para un viaje.
 *
 * Esto NO es una capa visual ni un flag binario: toma el contexto real del viaje
 * (hora granular, metros a pie, si la caminata va por avenida o calle interna, si toca
 * una zona de precaución nocturna, transbordos) y produce UNA recomendación accionable:
 * "tomá un taxi solo en este tramo", "esperá en la parada de la avenida", "hay otra ruta
 * casi igual con menos caminata de noche".
 *
 * Principios (NO negociables):
 *  - Sin alarmismo. La mayoría de los viajes → sin aviso.
 *  - Sin inventar riesgo: solo factores reales y verificables del viaje.
 *  - Sin nombrar barrios ni decir "peligroso". Hablamos de "zona poco transitada de noche".
 *  - La recomendación tiene que AYUDAR A DECIDIR, no solo pintar.
 *
 * Base conceptual real (criminología urbana, "eyes on the street" / Jane Jacobs +
 * prevención situacional): la exposición a pie sube con la distancia, la soledad de la
 * calle y la hora; baja sobre avenidas (más tránsito, luz y testigos) y con menos espera.
 */

import { isCautionNightZone } from "@/lib/safety-zones";

// ── Hora del día → factor de exposición 0..1 (NO binario) ─────────────
export type NightPhase = "day" | "dusk" | "night" | "lateNight";

export function montevideoHour(date: Date = new Date()): number {
  const h = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Montevideo", hour: "2-digit", hour12: false }).format(date);
  let hour = parseInt(h, 10);
  if (hour === 24) hour = 0;
  return hour;
}

/**
 * Factor de exposición por hora (0 = pleno día, 1 = madrugada). Granular a propósito:
 * caminar a las 20:30 no es lo mismo que a las 03:00.
 */
export function nightExposure(date: Date = new Date()): { phase: NightPhase; factor: number } {
  const h = montevideoHour(date);
  if (h >= 0 && h < 5) return { phase: "lateNight", factor: 1 };       // madrugada
  if (h >= 5 && h < 7) return { phase: "night", factor: 0.6 };          // amanecer temprano
  if (h >= 7 && h < 19) return { phase: "day", factor: 0 };             // día
  if (h >= 19 && h < 21) return { phase: "dusk", factor: 0.35 };        // anochecer
  return { phase: "night", factor: 0.7 };                               // 21–24h
}

// ── ¿La parada está sobre una avenida / vía principal? ────────────────
// Sobre avenida = más tránsito, luz y gente = tramo a pie más seguro. Proxy honesto
// por el nombre de la parada (no inventamos: si no podemos afirmarlo, asumimos "no").
const AVENUE_PREFIX = /(^|\s|[-,/])(av|avda|avenida|bv|bvar|bulevar|blvr|rambla)\.?(\s|$)/i;
// Arterias y calles principales de Montevideo: tránsito, luz y gente toda la noche →
// caminar sobre ellas es más seguro que por calles internas. Lista ampliada con las
// vías reales más transitadas (incluye céntricas peatonalmente activas).
const NAMED_AVENUES = [
  // Grandes avenidas
  "8 de octubre", "18 de julio", "gral flores", "general flores", "italia", "rivera",
  "brasil", "agraciada", "millan", "millán", "san martin", "san martín", "garzon", "garzón",
  "burgues", "burgués", "propios", "centenario", "artigas", "batlle y ordoñez", "batlle y ordonez",
  "luis alberto de herrera", "herrera", "buschental", "giannattasio", "italia bella",
  "camino maldonado", "cno maldonado", "camino carrasco", "cno carrasco", "camino corrales",
  "del fortin", "del fortín", "instrucciones", "luis batlle berres", "santin carlos rossi",
  "belloni", "jose belloni", "josé belloni", "carlos maria ramirez", "carlos maría ramírez",
  "libertador", "uruguay", "constituyente", "colonia", "mercedes", "españa", "espana",
  "21 de setiembre", "sarmiento", "larrañaga", "larranaga", "jose pedro varela", "josé pedro varela",
  "aparicio saravia", "gonzalo ramirez", "gonzalo ramírez", "bolivia", "ramon anador", "ramón anador",
  "san salvador", "rondeau", "yaguaron", "yaguarón", "paysandu", "paysandú", "rio branco", "río branco",
  "dr luis morquio", "av don pedro de mendoza", "bvar españa", "general paz", "felipe cardoso",
];

export function isOnAvenue(stopName?: string): boolean {
  if (!stopName) return false;
  const n = stopName.toLowerCase();
  if (AVENUE_PREFIX.test(stopName)) return true;
  return NAMED_AVENUES.some((a) => n.includes(a));
}

// ── Tipos del viaje (subset de PlannedRouteDto, para no acoplar) ───────
export interface SafetyLeg {
  type: "walk" | "bus";
  distanceM: number;
  durationS: number;
  fromStopName?: string;
  toStopName?: string;
  polyline?: [number, number][];
}
export interface SafetyTrip {
  legs: SafetyLeg[];
  numTransfers: number;
}

export type SafetyLevel = "none" | "info" | "soft" | "recommend";

export interface SafetyAction {
  kind: "taxi-leg" | "wait-on-avenue";
  /** Índice del leg al que aplica (para que la UI ofrezca taxi solo en ESE tramo). */
  legIndex: number;
  pickup?: { lat: number; lon: number };
  dropoff?: { lat: number; lon: number };
}

export interface TripSafetyAdvice {
  level: SafetyLevel;
  headline: string;
  detail: string;
  action?: SafetyAction;
  /** Métricas para comparar rutas entre sí (elegir "la más segura a pie de noche"). */
  exposureScore: number;
  nightWalkM: number;
}

const MIN_WALK_M = 450; // por menos de esto, caminás y listo (no tiene sentido un taxi)

/**
 * Evalúa un viaje y devuelve la mejor recomendación. exposureScore es comparable entre
 * rutas (mayor = más exposición a pie en este contexto horario).
 */
export function assessTripSafety(trip: SafetyTrip, now: Date = new Date()): TripSafetyAdvice {
  const { factor: nf, phase } = nightExposure(now);

  // Caminata total ponderada por contexto. De día (nf=0) el score es ~0 → sin avisos.
  let exposureScore = 0;
  let nightWalkM = 0;
  let worst: { idx: number; score: number; leg: SafetyLeg; inZone: boolean; onAvenue: boolean } | null = null;

  trip.legs.forEach((leg, idx) => {
    if (leg.type !== "walk" || leg.distanceM < 80) return;
    const end = leg.polyline?.[leg.polyline.length - 1];
    const inZone = end ? isCautionNightZone(end[0], end[1]) : false;
    // "Sobre avenida" si el tramo empieza o termina sobre una vía principal.
    const onAvenue = isOnAvenue(leg.fromStopName) || isOnAvenue(leg.toStopName);

    // Ponderación: distancia × hora; ×1.6 si zona de precaución; ×0.55 si avenida (más segura).
    let w = leg.distanceM * nf;
    if (inZone) w *= 1.6;
    if (onAvenue) w *= 0.55;

    if (nf > 0) nightWalkM += leg.distanceM;
    exposureScore += w;

    if (!worst || w > worst.score) worst = { idx, score: w, leg, inZone, onAvenue };
  });

  // Transbordos de noche = otra espera expuesta (peso suave, no dramático).
  exposureScore += trip.numTransfers * 60 * nf;

  // Día o exposición baja → sin aviso (la mayoría de los casos).
  if (nf === 0 || exposureScore < MIN_WALK_M * 0.5 || !worst) {
    return { level: "none", headline: "", detail: "", exposureScore, nightWalkM };
  }

  const w = worst as { idx: number; score: number; leg: SafetyLeg; inZone: boolean; onAvenue: boolean };
  const distM = Math.round(w.leg.distanceM);
  const walkMin = Math.max(1, Math.round((w.leg.durationS || distM / 1.25) / 60));
  const start = w.leg.polyline?.[0];
  const end = w.leg.polyline?.[w.leg.polyline.length - 1];
  const phaseTxt = phase === "lateNight" ? "de madrugada" : "de noche";

  // Acción concreta: taxi SOLO en el tramo más expuesto (no todo el viaje).
  const taxiAction: SafetyAction | undefined = (start && end && distM >= MIN_WALK_M)
    ? { kind: "taxi-leg", legIndex: w.idx, pickup: { lat: start[0], lon: start[1] }, dropoff: { lat: end[0], lon: end[1] } }
    : undefined;

  // Caso fuerte: tramo largo, de noche, en zona de precaución y NO sobre avenida.
  if (w.inZone && !w.onAvenue && distM >= MIN_WALK_M) {
    return {
      level: "recommend",
      headline: `Este tramo a pie conviene en taxi ${phaseTxt}`,
      detail: `Son ${distM} m caminando (~${walkMin} min) por una zona poco transitada a esta hora. Bajás en la última parada y pedís un taxi o Uber solo para ese tramo: te deja en la puerta.`,
      action: taxiAction,
      exposureScore,
      nightWalkM,
    };
  }

  // Caso medio: tramo largo de noche, pero sobre avenida → tranquilizar, no asustar.
  if (w.onAvenue && distM >= MIN_WALK_M) {
    return {
      level: "info",
      headline: "Tu caminata va por avenida",
      detail: `Caminás ${distM} m (~${walkMin} min) ${phaseTxt}, pero la mayor parte sobre una avenida, que suele estar transitada e iluminada. Si igual preferís, podés pedir un taxi para ese tramo.`,
      action: taxiAction,
      exposureScore,
      nightWalkM,
    };
  }

  // Caso suave: caminata larga de noche por calle interna (sin zona marcada).
  if (distM >= 600) {
    return {
      level: "soft",
      headline: `¿Preferís no caminar este tramo ${phaseTxt}?`,
      detail: `El tramo a pie son ${distM} m (~${walkMin} min) por calles internas. Si querés, lo hacés en taxi o Uber desde la última parada.`,
      action: taxiAction,
      exposureScore,
      nightWalkM,
    };
  }

  return { level: "none", headline: "", detail: "", exposureScore, nightWalkM };
}

/**
 * Compara rutas entre sí: ¿hay una ALTERNATIVA que, por un poco más de tiempo, reduce
 * mucho la exposición a pie de noche? Devuelve el índice de la recomendada o null.
 *
 * Útil de verdad: "esta sale 5 min después pero caminás 200 m en vez de 700 m de noche".
 */
export function saferAlternative(
  routes: SafetyTrip[],
  totalsSec: number[],
  bestIdx: number,
  now: Date = new Date()
): { idx: number; savedWalkM: number; extraMin: number } | null {
  const { factor: nf } = nightExposure(now);
  if (nf === 0 || routes.length < 2) return null;

  const best = assessTripSafety(routes[bestIdx], now);
  if (best.exposureScore < 400) return null; // la principal ya es tranquila

  let pick: { idx: number; savedWalkM: number; extraMin: number } | null = null;
  routes.forEach((r, i) => {
    if (i === bestIdx) return;
    const a = assessTripSafety(r, now);
    const extraMin = Math.round((totalsSec[i] - totalsSec[bestIdx]) / 60);
    if (extraMin > 12) return; // "apenas más larga": hasta 12 min
    // Reduce exposición al menos 35% y al menos 250 m menos de caminata nocturna.
    const savedWalkM = Math.round(best.nightWalkM - a.nightWalkM);
    const reduces = a.exposureScore <= best.exposureScore * 0.65 && savedWalkM >= 250;
    if (reduces && (!pick || a.exposureScore < assessTripSafety(routes[pick.idx], now).exposureScore)) {
      pick = { idx: i, savedWalkM, extraMin: Math.max(0, extraMin) };
    }
  });
  return pick;
}
