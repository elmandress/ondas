/**
 * "Modo frío" — sugerencias PROACTIVAS cuando la espera en la parada es larga.
 *
 * Hoy "A pasos también pasan" es reactivo: muestra qué líneas extra hay cerca, sin
 * decir CUÁNDO pasan. El modo frío es la versión proactiva: cuando el primer bus de
 * esta parada tarda >15 min (o no hay servicio), buscamos las llegadas EN VIVO de las
 * paradas a ≤300 m y, si caminando llegás a tiempo a un bus que sale antes, te lo
 * decimos de frente: "a 120 m el 405 llega en ~6 min".
 *
 * Reglas de honestidad (no romper):
 *  - Solo líneas que NO pasan por la parada actual. Si la misma línea "llega antes"
 *    a una parada vecina, casi siempre es el sentido contrario u otra variante —
 *    recomendar eso haría perder el bus. Se excluye de raíz.
 *  - Solo alternativas ALCANZABLES: eta del bus ≥ tiempo de caminata (con sinuosidad).
 *  - Solo si el ahorro es real: ≥ 5 min vs esperar acá (o ≤ 25 min si acá no hay nada).
 *  - Los horarios programados (sin GPS) se marcan igual que en el resto de la app.
 *
 * Lógica pura — el fetch vive en hooks/useColdAlternatives.
 */
import { walkingMinutes } from "@/lib/utils";
import { canonLine } from "@/lib/line-name";

/** Espera (min) a partir de la cual se activa el modo frío. */
export const COLD_THRESHOLD_MIN = 15;

/** Sin llegadas acá: no sugerir buses a más de esto (un horario a 50 min no es "alternativa"). */
const MAX_ETA_WHEN_EMPTY_MIN = 25;

/** Con llegadas acá: la alternativa debe ahorrar al menos esto para valer la caminata. */
const MIN_SAVING_MIN = 5;

/** ¿La espera califica como "fría"? null = sin llegadas conocidas. */
export function isColdWait(firstEtaMin: number | null): boolean {
  return firstEtaMin === null || firstEtaMin > COLD_THRESHOLD_MIN;
}

export interface AltStopArrival {
  line: string;
  destination: string;
  etaMin: number;
  isScheduled: boolean;
}

export interface AltStopInput {
  stopId: string;
  stopName: string;
  distM: number;
  arrivals: AltStopArrival[];
}

export interface ColdSuggestion {
  stopId: string;
  stopName: string;
  distM: number;
  walkMin: number;
  line: string;
  destination: string;
  etaMin: number;
  isScheduled: boolean;
}

/**
 * Elige las mejores alternativas frías (máx 2, una por línea, orden por ETA).
 *
 * @param hereEtaMin  ETA del primer bus en la parada actual (min); null = sin llegadas.
 * @param hereLines   Líneas que pasan por la parada actual (se excluyen — ver doc arriba).
 * @param altStops    Paradas vecinas con sus llegadas en vivo ya cargadas.
 */
export function pickColdAlternatives(
  hereEtaMin: number | null,
  hereLines: string[],
  altStops: AltStopInput[],
): ColdSuggestion[] {
  if (!isColdWait(hereEtaMin)) return [];

  // Canónico (R58e): hereLines puede venir de la API en vivo ("CE1") o del fallback
  // stops.json ("Ce1") según el estado de la red — comparar sin canon dejaba pasar
  // la misma línea como "alternativa" en modo degradado.
  const here = new Set(hereLines.map(canonLine));
  const bestByLine = new Map<string, ColdSuggestion>();

  for (const alt of altStops) {
    const walkMin = walkingMinutes(alt.distM);
    for (const a of alt.arrivals) {
      if (!a.line || here.has(canonLine(a.line))) continue;
      if (!Number.isFinite(a.etaMin) || a.etaMin < walkMin) continue; // no llegás caminando
      const beneficial = hereEtaMin === null
        ? a.etaMin <= MAX_ETA_WHEN_EMPTY_MIN
        : a.etaMin + MIN_SAVING_MIN <= hereEtaMin;
      if (!beneficial) continue;

      const existing = bestByLine.get(a.line);
      if (!existing || a.etaMin < existing.etaMin) {
        bestByLine.set(a.line, {
          stopId: alt.stopId,
          stopName: alt.stopName,
          distM: alt.distM,
          walkMin,
          line: a.line,
          destination: a.destination,
          etaMin: a.etaMin,
          isScheduled: a.isScheduled,
        });
      }
    }
  }

  return [...bestByLine.values()]
    .sort((a, b) => a.etaMin - b.etaMin || a.distM - b.distM)
    .slice(0, 2);
}
