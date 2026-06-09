"use client";

import type { PlannedRouteDto } from "@/hooks/useRouteplanner";

/**
 * Compartir un viaje (Web Share API → fallback al portapapeles). Sin backend.
 *
 * Caso de uso real: "voy para allá, te aviso por dónde y a qué hora llego" — muy
 * pedido en apps de transporte. El texto se arma SOLO con datos del viaje ya
 * calculado (líneas, paradas, minutos): nada inventado.
 */

function legsSummary(route: PlannedRouteDto): string {
  const parts: string[] = [];
  for (const leg of route.legs) {
    if (leg.type === "walk") {
      const m = Math.max(1, Math.round(leg.durationS / 60));
      parts.push(`caminás ${m} min`);
    } else {
      const lines = leg.lines && leg.lines.length ? leg.lines.join(" o ") : "bus";
      const from = leg.fromStopName ? ` desde ${leg.fromStopName}` : "";
      parts.push(`tomás el ${lines}${from}`);
    }
  }
  return parts.join(", ");
}

export function buildTripMessage(route: PlannedRouteDto, destinationName?: string): string {
  const totalMin = Math.max(1, Math.round(route.totalSeconds / 60));
  const dest = destinationName ? ` a ${destinationName}` : "";
  if (!route.legs || route.legs.length === 0) {
    return `Voy${dest}: ${totalMin} min en total. (vía Cuándo)`;
  }
  return `Voy${dest}: ${legsSummary(route)}. Son unos ${totalMin} min en total. (vía Cuándo)`;
}

/** Devuelve "shared" | "copied" | "error" para que la UI dé feedback honesto. */
export async function shareTrip(route: PlannedRouteDto, destinationName?: string): Promise<"shared" | "copied" | "error"> {
  const text = buildTripMessage(route, destinationName);
  try {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      await navigator.share({ title: "Mi viaje", text });
      return "shared";
    }
  } catch {
    // El usuario canceló el diálogo de compartir, o no está permitido: probamos copiar.
  }
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return "copied";
    }
  } catch {
    /* sin clipboard */
  }
  return "error";
}
