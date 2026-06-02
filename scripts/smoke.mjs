import { chromium } from "playwright";
const b = await chromium.launch();
const ctx = await b.newContext({ geolocation: { latitude: -34.9058, longitude: -56.1882 }, permissions: ["geolocation"] });
// Saltar el onboarding de primer uso (queremos probar la app, no la intro).
await ctx.addInitScript(() => { try { localStorage.setItem("ondas_prefs", JSON.stringify({ onboardingDone: true, favoriteRoutes: [], theme: "dark" })); } catch {} });
const p = await ctx.newPage();
const errs = [];
const warns = [];
p.on("pageerror", (e) => errs.push("PAGEERROR: " + e.message.slice(0, 160)));
p.on("console", (m) => {
  if (m.type() === "error") errs.push("CONSOLE.ERROR: " + m.text().slice(0, 160));
  if (m.type() === "warning") warns.push(m.text().slice(0, 100));
});
const step = async (name, fn) => { try { await fn(); console.log("✓", name); } catch (e) { console.log("✗", name, "-", e.message.slice(0, 60)); } };

await p.setViewportSize({ width: 390, height: 844 });
await p.goto("http://localhost:3000/", { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
await p.waitForTimeout(1800);

await step("Home carga", async () => { await p.locator("text=¿De dónde salís?").first().waitFor({ timeout: 5000 }); });
await step("Ajustes abre + Cómo funciona", async () => {
  await p.locator('button[aria-label="Ajustes"]:visible').first().click({ timeout: 4000 });
  await p.waitForTimeout(600);
  await p.locator("text=Cómo funciona Cuándo").first().click({ timeout: 4000 });
  await p.waitForTimeout(500);
  await p.locator('button[aria-label="Cerrar"]').first().click({ timeout: 3000 }).catch(() => {});
});
await step("Mis Rutas: abrir, nueva, guardar por dirección", async () => {
  await p.locator("text=/Agregar|Editar/").first().click({ timeout: 4000 });
  await p.waitForTimeout(700);
  await p.locator("text=Nueva ruta").first().click({ timeout: 4000 });
  await p.waitForTimeout(500);
  const modal = p.locator(".rounded-t-3xl").last();
  await modal.locator('input[placeholder*="Casa"]').fill("Trabajo");
  await modal.locator('input[placeholder*="esquina"]').fill("18 de julio y ejido");
  // esperar el resultado del geocode DENTRO del modal antes de clickear
  await modal.locator("button", { hasText: "Montevideo" }).first().waitFor({ timeout: 9000 });
  await modal.locator("button", { hasText: "Montevideo" }).first().click({ timeout: 4000 });
  await p.waitForTimeout(400);
  await modal.locator("text=Guardar ruta").click({ timeout: 4000 });
  await p.waitForTimeout(800);
  const n = await p.evaluate(() => (JSON.parse(localStorage.getItem("ondas_prefs") || "{}").favoriteRoutes || []).length);
  if (!n) throw new Error("no se guardó la ruta");
});
await step("Mapa", async () => { await p.locator('button[aria-label="Mapa"]:visible').first().click({ timeout: 4000 }); await p.waitForTimeout(2500); });
await step("Buscar", async () => { await p.locator('button[aria-label="Buscar"]:visible').first().click({ timeout: 4000 }); await p.waitForTimeout(1200); });
await step("Rutas (planner)", async () => { await p.locator('button[aria-label="Rutas"]:visible').first().click({ timeout: 4000 }); await p.waitForTimeout(1500); });

console.log("\n=== ERRORES (" + errs.length + ") ===");
[...new Set(errs)].forEach((e) => console.log(" •", e));
console.log("\n(warnings:", warns.length, ")");
await b.close();
