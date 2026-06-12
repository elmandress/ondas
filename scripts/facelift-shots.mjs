/**
 * Capturas para auditoría visual del facelift (R58).
 * Requiere el build de prod corriendo: PORT=3100 npm start
 * Uso: node scripts/facelift-shots.mjs [outdir] [tema]
 */
import { chromium } from "playwright";
import fs from "fs";

const OUT = process.argv[2] || "D:/tmp/shots-r58/before";
const THEME = process.argv[3] || "dark"; // dark | light
fs.mkdirSync(OUT, { recursive: true });

const BASE = "http://localhost:3100";
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  geolocation: { latitude: -34.9058, longitude: -56.1882 }, // Centro MVD
  permissions: ["geolocation"],
  colorScheme: THEME === "light" ? "light" : "dark",
});
await ctx.addInitScript((theme) => {
  try {
    localStorage.setItem("ondas_prefs", JSON.stringify({ onboardingDone: true, theme }));
    localStorage.setItem("ondas_tips_seen", JSON.stringify(["hero-leave", "map-longpress", "occupancy"]));
  } catch {}
}, THEME);
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

async function shot(name, url, opts = {}) {
  try {
    await page.goto(BASE + url, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
    await page.waitForTimeout(opts.wait ?? 2500);
    if (opts.action) await opts.action().catch(() => {});
    if (opts.afterWait) await page.waitForTimeout(opts.afterWait);
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: !!opts.full });
    console.log("✓", name);
  } catch (e) {
    console.log("✗", name, e.message);
  }
}

await shot("01-home", "/");
await shot("01b-home-full", "/", { full: true });
await shot("02-parada-sheet", "/?parada=3790", { wait: 4000 });
await shot("03-mapa", "/?tab=map", { wait: 4500 });
await shot("04-rutas-empty", "/?tab=routes");
await shot("05-rutas-resultados", "/?ir=tres%20cruces", { wait: 6000 });
await shot("06-buscar", "/?tab=search&q=pocitos", { wait: 3000, action: async () => {
  const input = page.locator("input").first();
  await input.fill("pocitos");
  await page.waitForTimeout(1500);
}});
await shot("07-linea-landing", "/linea/183", { wait: 3000 });
await shot("07b-linea-landing-full", "/linea/183", { full: true, wait: 3000 });
await shot("08-parada-landing", "/parada/3790", { wait: 3000 });

console.log("pageerrors:", errors.length, errors.slice(0, 3));
await browser.close();
