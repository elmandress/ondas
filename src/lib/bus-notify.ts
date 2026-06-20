"use client";

/**
 * Notificación LOCAL del dispositivo cuando el bus seguido está a N paradas (Feature A).
 * NO es Web Push (sin VAPID ni backend): la dispara el cliente vía el Service Worker ya
 * registrado (`registration.showNotification`), que persiste en la pantalla de bloqueo —
 * a diferencia de `new Notification()`, que no sobrevive con la pantalla apagada.
 *
 * LÍMITE HONESTO: el cliente detecta el cruce de "N paradas" mientras la página está VIVA
 * (foreground o background reciente). Si el SO suspende del todo la pestaña, la detección no
 * corre → para garantía total con la app cerrada hace falta Web Push (otra pieza, diferida).
 *
 * El permiso se pide SOLO cuando el usuario activa el aviso (no en el onboarding).
 */

export function notifySupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;
}

export function notifyPermission(): NotificationPermission | "unsupported" {
  if (!notifySupported()) return "unsupported";
  return Notification.permission;
}

/** Pide permiso (idempotente). Devuelve el estado final. */
export async function requestNotifyPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!notifySupported()) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

/** Dispara la notificación local del bus (no-op si no hay permiso o SW). */
export async function fireBusNotification(opts: {
  line: string;
  stops: number;
  stopName: string;
  stopId: string;
}): Promise<void> {
  if (!notifySupported() || Notification.permission !== "granted") return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const arriving = opts.stops <= 0;
    const body = arriving
      ? `El ${opts.line} está llegando a ${opts.stopName}. Salí a la parada.`
      : `Faltan ${opts.stops} parada${opts.stops > 1 ? "s" : ""} para ${opts.stopName}. Prepárate.`;
    // `vibrate`/`requireInteraction` no están en el tipo estándar de NotificationOptions.
    const options = {
      body,
      tag: `bus-follow-${opts.stopId}`, // reemplaza la anterior, no apila
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      vibrate: arriving ? [120, 60, 120, 60, 120] : [80, 40, 80],
      requireInteraction: arriving, // "bajate ahora" queda hasta que lo toques
      data: { url: `/?parada=${encodeURIComponent(opts.stopId)}` },
    } as NotificationOptions;
    await reg.showNotification(arriving ? "¡Tu bus está llegando!" : "Tu bus está cerca", options);
  } catch {
    /* SW no listo → no-op */
  }
}
