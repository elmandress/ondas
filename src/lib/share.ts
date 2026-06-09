"use client";

import { track } from "@/lib/analytics";

/**
 * Compartir entidades con URL LIMPIA y permanente (Web Share API → fallback copiar).
 *
 * Cada cosa compartible tiene su URL memorable: /linea/121, /parada/3971. Al abrirse,
 * la landing tiene SEO + Open Graph (preview linda en WhatsApp/X/Telegram) y un CTA que
 * lleva a /?linea=… o /?parada=… → la app abre el sheet directo. Eso convierte cada
 * "che, ¿cuándo pasa el 121?" en un link que se ve bien y trae gente nueva (loop viral).
 *
 * Origen dinámico (window.location.origin): funciona en prod, previews y local sin tocar nada.
 */

function siteOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) return window.location.origin;
  return process.env.NEXT_PUBLIC_SITE_URL || "https://cuando.uy";
}

export type ShareResult = "shared" | "copied" | "error";

async function shareOrCopy(payload: { title: string; text: string; url: string }, kind: string): Promise<ShareResult> {
  if (typeof navigator !== "undefined" && "share" in navigator) {
    try {
      await navigator.share(payload);
      track("share", { kind, method: "native" });
      return "shared";
    } catch (e) {
      // AbortError = el usuario cerró el diálogo a propósito → NO copiamos (sería confuso
      // decir "copiado" cuando canceló). Cualquier otro error → caemos a copiar.
      if (e instanceof DOMException && e.name === "AbortError") return "error";
    }
  }
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(`${payload.text}\n${payload.url}`);
      track("share", { kind, method: "copy" });
      return "copied";
    }
  } catch {
    /* sin clipboard */
  }
  return "error";
}

/** Comparte una parada → /parada/{id}. Si se pasa la próxima llegada, arma el mensaje
 *  útil "voy para allá": "El 121 llega en ~5 min a {parada}". La ETA es del momento
 *  (por eso "~"); el link lleva a la llegada en vivo para que el otro la siga. */
export function shareStop(stopId: string, stopName: string, stopCode?: string, next?: { line: string; etaMin: number }): Promise<ShareResult> {
  const text = next
    ? `El ${next.line} llega en ~${next.etaMin} min a ${stopName} (ahora). Seguilo en vivo en Cuándo`
    : `Llegadas en vivo de la parada ${stopName} en Cuándo`;
  return shareOrCopy(
    {
      title: `Parada ${stopCode ?? stopId} · Cuándo`,
      text,
      url: `${siteOrigin()}/parada/${encodeURIComponent(stopId)}`,
    },
    "parada"
  );
}

/** Comparte una línea → /linea/{line}. */
export function shareLine(line: string, destination?: string): Promise<ShareResult> {
  return shareOrCopy(
    {
      title: `Línea ${line} · Cuándo`,
      text: `Recorrido y llegadas en vivo de la línea ${line}${destination ? ` a ${destination}` : ""} en Cuándo`,
      url: `${siteOrigin()}/linea/${encodeURIComponent(line)}`,
    },
    "linea"
  );
}
