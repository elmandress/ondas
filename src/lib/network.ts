/**
 * network.ts — Conciencia de red para ahorrar datos en celular.
 *
 * Usa la Network Information API (donde existe — Chrome/Android, que es nuestro
 * target principal) para detectar "Ahorro de datos" y conexiones lentas, y así
 * espaciar el polling. En WiFi/4G anda a velocidad normal; en 2G/3G o con Data
 * Saver, refresca menos seguido. Si la API no existe (iOS/desktop), no penaliza.
 */

interface NavConnection {
  saveData?: boolean;
  effectiveType?: string; // "slow-2g" | "2g" | "3g" | "4g"
  type?: string; // "cellular" | "wifi" | ...
}

function conn(): NavConnection | undefined {
  if (typeof navigator === "undefined") return undefined;
  return (
    (navigator as Navigator & { connection?: NavConnection }).connection ||
    (navigator as Navigator & { mozConnection?: NavConnection }).mozConnection ||
    (navigator as Navigator & { webkitConnection?: NavConnection }).webkitConnection
  );
}

export interface NetInfo {
  saveData: boolean;
  slow: boolean; // 2g / slow-2g
  cellular: boolean; // datos móviles (no wifi)
}

export function getNetInfo(): NetInfo {
  const c = conn();
  if (!c) return { saveData: false, slow: false, cellular: false };
  const et = c.effectiveType || "";
  return {
    saveData: !!c.saveData,
    slow: et === "2g" || et === "slow-2g",
    cellular: c.type === "cellular" || et === "2g" || et === "slow-2g" || et === "3g",
  };
}

/**
 * Ajusta un intervalo base (ms) según la red: en WiFi/4G queda igual; con Data
 * Saver o conexión lenta/celular se espacia para gastar menos datos.
 */
export function adaptInterval(baseMs: number): number {
  const n = getNetInfo();
  let factor = 1;
  if (n.cellular) factor = Math.max(factor, 1.6);
  if (n.slow) factor = Math.max(factor, 3);
  if (n.saveData) factor = Math.max(factor, 2.5);
  return Math.round(baseMs * factor);
}
