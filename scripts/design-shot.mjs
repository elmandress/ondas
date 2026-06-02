import { chromium } from "playwright";
const url = "http://localhost:8899/Cu%C3%A1ndo.html";
const browser = await chromium.launch();
const page = await browser.newPage();
for (const bp of [{ n: "design-desktop", w: 1440, h: 900 }, { n: "design-mobile", w: 390, h: 844 }]) {
  await page.setViewportSize({ width: bp.w, height: bp.h });
  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `D:/tmp/shots/${bp.n}-home.png` });
  try { await page.locator(".hero-card").first().click({ timeout: 2000 }); } catch {}
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `D:/tmp/shots/${bp.n}-stop.png` });
  console.log("saved", bp.n);
}
await browser.close();
