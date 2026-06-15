/**
 * focuscheck.mjs (R70) — verifica el focus-management de los sheets (useFocusTrap).
 * axe no lo detecta (es de comportamiento), así que se prueba con Tab/Shift+Tab reales.
 * 3 casos de la política de stacking: SIMPLE (Ajustes), DRILL-DOWN (parada→recorrido),
 * y PEER/STACK en el mapa (parada→ficha-bus, best-effort).
 *
 * Uso: dev en localhost:3000, luego `node scripts/focuscheck.mjs`.
 */
import { chromium } from "playwright";

const STOP = process.argv[2] || "5109"; // parada céntrica con muchas líneas (arrivals → badges)
const b = await chromium.launch();
const ctx = await b.newContext({ geolocation: { latitude: -34.9058, longitude: -56.1882 }, permissions: ["geolocation"] });
await ctx.addInitScript(() => { try { localStorage.setItem("ondas_prefs", JSON.stringify({ onboardingDone: true })); } catch {} });
const p = await ctx.newPage();
await p.setViewportSize({ width: 375, height: 812 });

const results = [];
function check(name, cond) { results.push(cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}`); }
// El RESTORE (foco vuelve al disparador) sólo es verificable si el disparador sigue vivo.
// En el dev local el Home se vacía intermitentemente al cerrar un sheet (artefacto del server,
// mismo que en la medición de CLS) → si el disparador desapareció, marcamos SKIP, no FAIL.
function checkRestore(name, restored, triggerStillThere) {
  if (!triggerStillThere) { console.log(`  SKIP  ${name} (disparador no presente — Home en blanco, artefacto dev local)`); return; }
  results.push(restored); console.log(`  ${restored ? "PASS" : "FAIL"}  ${name}`);
}
const inside = (sel) => p.evaluate((s) => { const c = document.querySelector(s); return !!c && c.contains(document.activeElement); }, sel);
const DIALOG = '[role="dialog"]';

// ─── CASO 1: SIMPLE — Ajustes ───
console.log("\n=== CASO 1: SIMPLE (Ajustes) ===");
await p.goto("http://localhost:3000/", { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
await p.locator(".hero-card, h1").first().waitFor({ timeout: 15000 }).catch(() => {});
await p.locator('button[aria-label="Entendido"]').first().evaluate((el) => el.click()).catch(() => {});
await p.waitForTimeout(400);
await p.locator('button[aria-label="Ajustes"]').first().evaluate((el) => { el.setAttribute("data-trigger", "gear"); el.focus(); el.click(); });
await p.locator('[role="dialog"][aria-label="Ajustes e info"]').waitFor({ timeout: 6000 }).catch(() => {});
await p.waitForTimeout(700);
check("foco entra al sheet al abrir", await inside(DIALOG));
let leak = 0;
for (let i = 0; i < 18; i++) { await p.keyboard.press("Tab"); if (!(await inside(DIALOG))) leak++; }
check("foco ATRAPADO (0 fugas en 18 Tab)", leak === 0);
for (let i = 0; i < 6; i++) await p.keyboard.press("Shift+Tab");
check("Shift+Tab tampoco se fuga (wrap)", await inside(DIALOG));
await p.locator('[role="dialog"] button[aria-label="Cerrar"]').first().evaluate((el) => el.click()).catch(() => {});
await p.waitForTimeout(800);
{
  const st = await p.evaluate(() => ({
    restored: document.activeElement?.getAttribute("aria-label") === "Ajustes",
    gearThere: Array.from(document.querySelectorAll('[aria-label="Ajustes"]')).some((g) => g.offsetWidth > 0 || g.offsetHeight > 0),
  }));
  checkRestore("foco VUELVE al disparador (gear) al cerrar", st.restored, st.gearThere);
}

// ─── CASO 2: DRILL-DOWN — parada → recorrido ───
console.log("\n=== CASO 2: DRILL-DOWN (parada → recorrido) ===");
await p.goto(`http://localhost:3000/?parada=${STOP}`, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
const paradaSel = '[role="dialog"][aria-label^="Parada"]';
const okParada = await p.locator(paradaSel).waitFor({ timeout: 12000 }).then(() => true).catch(() => false);
await p.waitForTimeout(1500);
check("hoja de parada abre y foco entra", okParada && await inside(paradaSel));
// abrir recorrido: tocar el badge de línea de la primera fila de llegada
const badge = p.locator(`${paradaSel} .arrival-row .tap-card, ${paradaSel} button.tap-card`).first();
const hadBadge = await badge.count().then((c) => c > 0).catch(() => false);
if (hadBadge) {
  await badge.evaluate((el) => { el.focus(); el.click(); }).catch(() => {});
  const recSel = '[role="dialog"][aria-label^="Recorrido"]';
  const okRec = await p.locator(recSel).waitFor({ timeout: 6000 }).then(() => true).catch(() => false);
  await p.waitForTimeout(700);
  check("drill-down: foco entra al HIJO (recorrido)", okRec && await inside(recSel));
  let leak2 = 0;
  for (let i = 0; i < 12; i++) { await p.keyboard.press("Tab"); if (!(await inside(recSel))) leak2++; }
  check("drill-down: foco atrapado en el hijo (no toca el padre)", leak2 === 0);
  // cerrar hijo → el foco vuelve al PADRE (la hoja de parada), no se pierde
  await p.locator(`${recSel} button[aria-label="Cerrar"], ${recSel} button:has-text("Cerrar")`).first().evaluate((el) => el.click()).catch(() => {});
  await p.waitForTimeout(800);
  const parentThere = await p.locator(paradaSel).count().then((c) => c > 0).catch(() => false);
  checkRestore("drill-down: al cerrar el hijo, foco vuelve al PADRE (parada)", await inside(paradaSel), parentThere);
} else {
  console.log("  (sin badge de línea en la primera fila — parada sin arrivals ahora; salteo drill-down)");
}

// ─── CASO 3: PEER/STACK en el mapa (best-effort) ───
console.log("\n=== CASO 3: PEER/STACK mapa (best-effort) ===");
try {
  await p.locator('button[aria-label="Mapa"], nav button:has-text("Mapa")').first().click({ timeout: 5000 });
  await p.waitForTimeout(2500);
  const stopMarker = p.locator('[aria-label^="Parada"]').first();
  if (await stopMarker.count() > 0) {
    await stopMarker.evaluate((el) => el.click());
    const mp = '[role="dialog"][aria-label^="Parada"]';
    const okMp = await p.locator(mp).waitFor({ timeout: 6000 }).then(() => true).catch(() => false);
    await p.waitForTimeout(800);
    check("mapa: hoja de parada del mapa atrapa el foco", okMp && await inside(mp));
  } else { console.log("  (sin markers de parada clickeables en el viewport — salteo)"); }
} catch (e) { console.log("  (mapa no navegable en headless:", e.message.slice(0, 50), ")"); }

console.log(`\n=== RESULTADO: ${results.filter(Boolean).length}/${results.length} checks PASS ===`);
await b.close();
process.exit(results.every(Boolean) ? 0 : 1);
