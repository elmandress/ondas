// Capturas de la app en 3 breakpoints × pantallas. Salida en d:/tmp/shots.
// Uso: node scripts/shots.mjs [tab]   (tab opcional: home|map|route|search)
import { chromium } from "playwright";
import { mkdirSync } from "fs";

const OUT = "D:/tmp/shots";
mkdirSync(OUT, { recursive: true });

const BREAKPOINTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 834, height: 1112 },
  { name: "desktop", width: 1440, height: 900 },
];
const TABS = ["Inicio", "Mapa", "Rutas", "Buscar"];
const onlyTab = process.argv[2];

const browser = await chromium.launch();
const ctx = await browser.newContext({
  // Conceder geolocalización (Plaza Independencia, MVD) para ver contenido real.
  geolocation: { latitude: -34.9058, longitude: -56.1882 },
  permissions: ["geolocation"],
});
const page = await ctx.newPage();

for (const bp of BREAKPOINTS) {
  await page.setViewportSize({ width: bp.width, height: bp.height });
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(1500);

  for (const tab of TABS) {
    if (onlyTab && tab.toLowerCase() !== onlyTab.toLowerCase()) continue;
    try {
      // Click el nav item por aria-label (hay 2: sidebar + bottom-nav; el visible se clickea).
      const btn = page.locator(`button[aria-label="${tab}"]:visible`).first();
      await btn.click({ timeout: 4000 });
    } catch {}
    await page.waitForTimeout(1800);
    const file = `${OUT}/${bp.name}-${tab}.png`;
    await page.screenshot({ path: file });
    console.log("saved", file);
  }
}

await browser.close();
console.log("done");
