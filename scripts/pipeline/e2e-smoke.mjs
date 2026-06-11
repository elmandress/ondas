/**
 * Smoke E2E para CI (compuerta dura, exit 1 si algo falla).
 *
 * Diferencia con scripts/smoke.mjs (diagnóstico local, nunca falla): este es un
 * GATE. Valida que la app realmente BOOTEA y los 4 tabs funcionan en un entorno
 * sin credenciales STM y con APIs externas posiblemente inaccesibles — o sea,
 * prueba la DEGRADACIÓN real además del happy path. La suite unitaria no puede
 * detectar "la app no abre" (hydration rota, chunk faltante, error en módulo).
 *
 * Requiere: app corriendo en BASE_URL (default http://localhost:3000).
 * Uso: node scripts/pipeline/e2e-smoke.mjs
 */
import { chromium } from "playwright";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const failures = [];
const pageErrors = [];

const browser = await chromium.launch();
const ctx = await browser.newContext({
  geolocation: { latitude: -34.9058, longitude: -56.1882 }, // Centro de MVD
  permissions: ["geolocation"],
  viewport: { width: 390, height: 844 },
});
// Saltar onboarding: probamos la app, no la intro.
await ctx.addInitScript(() => {
  try { localStorage.setItem("ondas_prefs", JSON.stringify({ onboardingDone: true, favoriteRoutes: [], theme: "dark" })); } catch {}
});
const page = await ctx.newPage();
page.on("pageerror", (e) => pageErrors.push(e.message.slice(0, 200)));

async function step(name, fn) {
  try {
    await fn();
    console.log(`✓ ${name}`);
  } catch (e) {
    failures.push(`${name}: ${e.message.split("\n")[0].slice(0, 140)}`);
    console.error(`✗ ${name} — ${e.message.split("\n")[0].slice(0, 140)}`);
  }
}

await step("la app carga (HTML + hidratación)", async () => {
  const res = await page.goto(BASE_URL + "/", { waitUntil: "domcontentloaded", timeout: 45_000 });
  if (!res || !res.ok()) throw new Error(`HTTP ${res?.status()}`);
  // La navegación inferior visible es el esqueleto mínimo de la SPA hidratada.
  // (:visible importa: la sidebar desktop duplica los botones pero está oculta en mobile.)
  await page.locator('button[aria-label="Mapa"]:visible').first().waitFor({ timeout: 20_000 });
});

await step("tab Buscar: el buscador responde con datos locales", async () => {
  await page.locator('button[aria-label="Buscar"]:visible').first().click();
  const input = page.locator('input[type="text"], input[type="search"]').first();
  await input.waitFor({ timeout: 8000 });
  await input.fill("Tres Cruces");
  // POI curado local (mvd-pois.json) — determinístico, sin APIs externas.
  await page.locator("text=/Tres Cruces/i").nth(1).waitFor({ timeout: 12_000 });
});

await step("tab Mapa: Leaflet monta el canvas", async () => {
  await page.locator('button[aria-label="Mapa"]:visible').first().click();
  // :visible — el preview de la Home también es .leaflet-container pero queda
  // visibility:hidden al cambiar de tab (MAP-1).
  await page.locator(".leaflet-container:visible").first().waitFor({ timeout: 20_000 });
});

await step("tab Rutas: el planificador renderiza sus inputs", async () => {
  await page.locator('button[aria-label="Rutas"]:visible').first().click();
  // Estado inicial: fila "Hacia · Tocá para elegir" (el input aparece al tocar).
  await page.getByText("Tocá para elegir").first().waitFor({ timeout: 15_000 });
});

await step("tab Inicio: vuelve sin romper estado", async () => {
  await page.locator('button[aria-label="Inicio"]:visible').first().click();
  await page.locator('button[aria-label="Mapa"]:visible').first().waitFor({ timeout: 5000 });
});

await browser.close();

// Errores de página (excepciones no capturadas) son SIEMPRE fatales: la app del
// usuario explotó aunque los pasos hayan pasado.
if (pageErrors.length > 0) {
  console.error(`\n✗ ${pageErrors.length} pageerror(s):`);
  [...new Set(pageErrors)].slice(0, 8).forEach((e) => console.error(`  • ${e}`));
}
if (failures.length > 0 || pageErrors.length > 0) {
  console.error(`\nSMOKE FALLÓ: ${failures.length} paso(s) + ${pageErrors.length} pageerror(s).`);
  process.exit(1);
}
console.log("\nSmoke E2E OK — la app bootea y los 4 tabs funcionan (sin credenciales STM).");
