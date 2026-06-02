// Inspecciona errores de consola + captura sub-componentes (sheet, modales).
import { chromium } from "playwright";
import { mkdirSync } from "fs";
const OUT = "D:/tmp/shots";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  geolocation: { latitude: -34.9058, longitude: -56.1882 },
  permissions: ["geolocation"],
});
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));

await page.setViewportSize({ width: 1440, height: 900 });
await page.goto("http://localhost:3000/", { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
await page.waitForTimeout(2500);

// Abrir el sheet de llegadas: click en una parada cercana (chip).
try {
  await page.locator(".stop-chip").first().click({ timeout: 5000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/desktop-stopsheet.png` });
  console.log("saved stopsheet");
} catch (e) { console.log("stopsheet fail", e.message); }

// Cerrar sheet
try { await page.locator('.bottom-sheet .icon-btn[aria-label="Cerrar"]').click({ timeout: 3000 }); await page.waitForTimeout(600); } catch {}

// Abrir RoutesManager: botón "Agregar" en Mis rutas
try {
  await page.locator('button.link:has-text("Agregar")').first().click({ timeout: 4000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/desktop-routesmanager.png` });
  console.log("saved routesmanager");
} catch (e) { console.log("routesmanager fail", e.message); }

console.log("\n=== CONSOLE ERRORS (" + errors.length + ") ===");
for (const e of errors.slice(0, 20)) console.log("•", e.slice(0, 300));

await browser.close();
