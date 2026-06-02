import { chromium } from "playwright";
const browser = await chromium.launch();
const ctx = await browser.newContext({
  geolocation: { latitude: -34.9058, longitude: -56.1882 },
  permissions: ["geolocation"],
});
const page = await ctx.newPage();
await page.setViewportSize({ width: 390, height: 844 });
await page.goto("http://localhost:3000/", { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
await page.waitForTimeout(1500);
await page.locator(`button[aria-label="Rutas"]:visible`).first().click().catch(() => {});
await page.waitForTimeout(1200);
await page.locator(".input-row.to").first().click().catch(() => {});
await page.waitForTimeout(600);
await page.locator('input[placeholder*="dónde"]').first().fill("Portones Shopping").catch(() => {});
await page.waitForTimeout(2500);
await page.locator(".card-soft, button").filter({ hasText: /Portones|Shopping/i }).first().click({ timeout: 4000 }).catch(() => {});
await page.waitForTimeout(4000);
// Expandir la primera ruta (tocar para ver paso a paso)
await page.locator(".card button").first().click().catch((e) => console.log("click err", e.message));
await page.waitForTimeout(2500);
await page.locator(".card button").first().scrollIntoViewIfNeeded().catch(() => {});
await page.screenshot({ path: `D:/tmp/shots/mobile-rutas-expand.png` });
console.log("saved expanded");
// Ver en el mapa → panel de ruta del mapa
await page.locator("button").filter({ hasText: /Ver en el mapa/i }).first().click().catch((e) => console.log("map err", e.message));
await page.waitForTimeout(4000);
await page.screenshot({ path: `D:/tmp/shots/mobile-mapa-ruta.png` });
console.log("saved mapa-ruta");
await browser.close();
