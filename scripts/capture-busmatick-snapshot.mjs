/**
 * Captura UN snapshot crudo del feed Busmatick de una zona del interior y lo guarda como
 * fixture de test. Espejo de cómo las paradas 2201/4615 fijaron los buses-fantasma de MVD:
 * un dato real, congelado, que pin-ea el parser (nombres de campos: sen/p1c/p2c/reg) y la
 * integración del motor `bus-direction-interior` sin depender de dato vivo en CI.
 *
 * Re-correr cuando el feed cambie de forma (Busmatick agrega/renombra campos):
 *   node scripts/capture-busmatick-snapshot.mjs maldonado
 *
 * El XML es público (posición de buses en servicio) — sin PII. Se guarda tal cual llega.
 */
import fs from "fs";
import path from "path";

const SOURCES = {
  maldonado: "http://ip.codesa.com.uy/pub/avl.xml",
  sancarlos: "http://solantigua.ddns.net:2780/pub/avl.xml",
  paysandu: "https://bus.copay.com.uy:10443/pub/avl.xml",
};

async function main() {
  const zona = process.argv[2] || "maldonado";
  const url = SOURCES[zona];
  if (!url) {
    console.error(`zona desconocida: ${zona}. Opciones: ${Object.keys(SOURCES).join(", ")}`);
    process.exit(1);
  }
  const res = await fetch(`${url}?nc=${Date.now()}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  // Busmatick XML es latin1.
  const xml = Buffer.from(await res.arrayBuffer()).toString("latin1");
  const markers = (xml.match(/<marker>[\s\S]*?<\/marker>/gi) || []).length;

  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const dir = path.join(process.cwd(), "tests", "fixtures");
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, `busmatick-${zona}-${date}.xml`);
  fs.writeFileSync(out, xml, "latin1");
  console.log(`[snapshot] ${zona}: ${markers} markers → ${out}`);
}
main().catch((e) => { console.error(e.message); process.exit(1); });
