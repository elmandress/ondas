/**
 * Metadatos de la app en UN solo lugar. Antes la versión estaba triplicada y
 * desincronizada (AppShell "v0.8 · build STM", SettingsSheet "0.8",
 * package.json "0.1.0"). Esta es la fuente de verdad para UI.
 */
export const APP_VERSION = "0.10";
export const APP_UPDATED = "junio 2026";
export const APP_CONTACT = "neptuno.rossello@gmail.com";

/**
 * Principios del producto ("qué hacemos / qué no"). Se muestran en la sección
 * "Sobre Cuándo" y guían cada decisión técnica. No es marketing: cada ítem
 * corresponde a una decisión real verificable en el código.
 */
export const WE_DO: string[] = [
  "Mostramos datos oficiales del transporte (STM, MTOP y sistemas del interior).",
  "Marcamos qué es GPS en vivo y qué es horario programado.",
  "Calculamos cuándo SALIR de tu casa, no solo cuándo llega el bus.",
  "Funcionamos sin cuenta y sin guardar tu ubicación.",
  "Andamos rápido y sin señal: el catálogo queda cacheado en tu teléfono.",
];

export const WE_DONT: string[] = [
  "No inventamos datos: si no lo sabemos con certeza, te lo decimos.",
  "No mostramos buses que ya pasaron tu parada o van en sentido contrario.",
  "No te rastreamos ni vendemos tus datos. No hay publicidad.",
  "No te pedimos tu cédula ni tu tarjeta: el saldo se consulta en el sitio oficial.",
  "No prometemos exactitud imposible: las llegadas son estimaciones honestas.",
];
