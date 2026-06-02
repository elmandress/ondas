import { chromium } from "playwright";
const browser = await chromium.launch();
const ctx = await browser.newContext({
  geolocation: { latitude: -34.9058, longitude: -56.1882 },
  permissions: ["geolocation"],
});
const page = await ctx.newPage();
for (const bp of [{ n: "desktop", w: 1440, h: 900 }, { n: "mobile", w: 390, h: 844 }]) {
  await page.setViewportSize({ width: bp.w, height: bp.h });
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await page.locator(`button[aria-label="Rutas"]:visible`).first().click().catch(() => {});
  await page.waitForTimeout(1200);
  // Tocar "Hacia"
  await page.locator(".input-row.to").first().click().catch(() => {});
  await page.waitForTimeout(600);
  await page.locator('input[placeholder*="dónde"]').first().fill("Portones Shopping").catch(() => {});
  await page.waitForTimeout(2500);
  // Click primera sugerencia
  await page.locator(".card-soft, button").filter({ hasText: /Portones|Shopping/i }).first().click({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `D:/tmp/shots/${bp.n}-rutas.png` });
  console.log("saved", bp.n);
}
await browser.close();
