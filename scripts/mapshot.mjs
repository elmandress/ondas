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
  await page.locator(`button[aria-label="Mapa"]:visible`).first().click().catch(() => {});
  await page.waitForTimeout(3500);

  const markers = page.locator(".leaflet-marker-icon");
  const count = await markers.count();
  let opened = false;
  for (let i = 0; i < Math.min(count, 25); i++) {
    const m = markers.nth(i);
    const box = await m.boundingBox().catch(() => null);
    // Evitar markers detrás de la top bar (y < 120)
    if (!box || box.y < 130) continue;
    await m.click({ timeout: 2500, force: true }).catch(() => {});
    await page.waitForTimeout(1200);
    if (await page.locator(".map-stop-panel").count()) { opened = true; break; }
  }
  console.log(bp.n, "panel opened:", opened, "markers:", count);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `D:/tmp/shots/${bp.n}-map-stop.png` });
}
await browser.close();
