// Research-only (Frente 2): mide el tiempo REAL entre paradas consecutivas del interior
// para calibrar AVG_SECONDS_PER_HOP (puesto a ojo en 90s). Captura snapshots de Busmatick
// cada 60s y registra, por coche, cuándo cambia su p1c (= cruzó a la siguiente parada).
// El delta de tiempo entre dos p1c distintos del mismo coche ≈ tiempo de 1 hop real.
import fs from "fs";
const URL = "http://ip.codesa.com.uy/pub/avl.xml";
const OUT = "d:/tmp/interior-hops.jsonl";
const ROUNDS = 12, EVERY_MS = 60000;
const tag = (b, t) => { const m = b.match(new RegExp(`<${t}>([^<]*)</${t}>`, "i")); return m ? m[1].trim() : ""; };

async function snap() {
  try {
    const r = await fetch(`${URL}?nc=${Date.now()}`, { signal: AbortSignal.timeout(8000) });
    const xml = Buffer.from(await r.arrayBuffer()).toString("latin1");
    const buses = (xml.match(/<marker>[\s\S]*?<\/marker>/gi) || []).map((m) => ({
      bus: tag(m, "bus"), line: tag(m, "lin"), sen: tag(m, "sen"),
      p1c: tag(m, "p1c"), p1n: tag(m, "p1n"), vel: +tag(m, "vel"),
    }));
    fs.appendFileSync(OUT, JSON.stringify({ t: Date.now(), buses }) + "\n");
    return buses.length;
  } catch (e) { fs.appendFileSync(OUT, JSON.stringify({ t: Date.now(), err: e.message }) + "\n"); return 0; }
}

(async () => {
  fs.writeFileSync(OUT, "");
  for (let i = 0; i < ROUNDS; i++) {
    const n = await snap();
    console.log(`[${i + 1}/${ROUNDS}] ${new Date().toLocaleTimeString()} — ${n} buses`);
    if (i < ROUNDS - 1) await new Promise((r) => setTimeout(r, EVERY_MS));
  }
  console.log("captura completa →", OUT);
})();
