/**
 * Validación de alineamiento shapes ↔ paradas (R57).
 *
 * Para cada variante GTFS urbana, mide la peor distancia (maxGap) entre sus
 * paradas y la MEJOR shape disponible de su línea (line-shapes.json → routes.json).
 * Un maxGap alto = el trazo dibujado no representa el recorrido real (recorrido
 * cambiado, shape vieja, o la variante sale de Montevideo y el SIT la clipea).
 *
 * El cliente ya se defiende solo (guard ≤120m en useEnrichedRouteLegs y
 * LeafletMap → cae a la polyline por paradas), así que esto NO es un gate duro:
 * falla únicamente si el desalineamiento EMPEORA mucho contra el umbral
 * estructural conocido (las ~240 variantes que cruzan a Canelones, donde el
 * shapefile de la IM termina). Si falla → regenerar con `npm run routes:update`.
 *
 * Uso: node scripts/pipeline/check-shape-alignment.mjs
 */
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf-8"));

const gtfs = read("data/gtfs-v2.json");
const routes = read("public/routes.json");
const lineShapesRaw = read("public/line-shapes.json");
const stopsArr = read("public/stops.json");

const canon = (s) => s.trim().replace(/\s+/g, " ").toUpperCase();
const lineShapes = {};
for (const [k, v] of Object.entries(lineShapesRaw)) (lineShapes[canon(k)] ||= []).push(...v);

const stopCoord = new Map();
for (const s of stopsArr) stopCoord.set(String(s.stopId), [s.stopLat, s.stopLon]);

function distM(a, b) {
  const dx = (b[1] - a[1]) * 111320 * Math.cos((a[0] * Math.PI) / 180);
  const dy = (b[0] - a[0]) * 111320;
  return Math.hypot(dx, dy);
}

// Umbrales: las variantes que salen de MVD (SIT clipea en el límite departamental)
// rondan las ~240 con gap >120m. Si esto crece fuerte, los shapes envejecieron.
const GAP_OK_M = 120;
const MAX_VARIANTS_OVER_GAP = 320;
const MAX_URBAN_LINES_WITHOUT_SHAPE = 5;

let over = 0;
let urbanNoShape = [];
let evaluated = 0;
const worst = [];

for (const [vid, meta] of Object.entries(gtfs.variantMeta)) {
  if (vid.startsWith("M-")) continue; // metro: sin shapes SIT, fallback por paradas es el esperado
  const stops = gtfs.stopsByVariant[vid] || [];
  const coords = stops.map(([sid]) => stopCoord.get(String(sid))).filter(Boolean);
  if (coords.length < 2) continue;
  evaluated++;
  const cvs = lineShapes[canon(meta.shortName)] || [];
  if (!cvs.length) {
    if (!urbanNoShape.includes(meta.shortName)) urbanNoShape.push(meta.shortName);
    continue;
  }
  let best = Infinity;
  for (const cv of cvs) {
    const shape = routes[cv];
    if (!shape || shape.length < 2) continue;
    let maxGap = 0;
    for (const c of coords) {
      let m = Infinity;
      for (const p of shape) { const d = distM(p, c); if (d < m) m = d; }
      if (m > maxGap) maxGap = m;
      if (maxGap > best) break;
    }
    if (maxGap < best) best = maxGap;
  }
  if (best > GAP_OK_M) {
    over++;
    worst.push({ line: meta.shortName, vid, gap: Math.round(best) });
  }
}

worst.sort((a, b) => b.gap - a.gap);
console.log(`Variantes urbanas evaluadas: ${evaluated}`);
console.log(`Con mejor shape a >${GAP_OK_M}m de alguna parada: ${over} (umbral: ${MAX_VARIANTS_OVER_GAP})`);
console.log(`Líneas urbanas SIN shape: ${urbanNoShape.length} (umbral: ${MAX_URBAN_LINES_WITHOUT_SHAPE})`, urbanNoShape.slice(0, 10).join(", "));
if (worst.length) console.log("Peores:", worst.slice(0, 8).map((w) => `${w.line} ${w.gap}m`).join(" · "));

let failed = false;
if (over > MAX_VARIANTS_OVER_GAP) {
  console.error(`✗ Demasiadas variantes desalineadas (${over} > ${MAX_VARIANTS_OVER_GAP}). Regenerar: npm run routes:update`);
  failed = true;
}
if (urbanNoShape.length > MAX_URBAN_LINES_WITHOUT_SHAPE) {
  console.error(`✗ Líneas urbanas sin shape (${urbanNoShape.length} > ${MAX_URBAN_LINES_WITHOUT_SHAPE}). Regenerar: npm run routes:update`);
  failed = true;
}
if (failed) process.exit(1);
console.log("✓ Alineamiento shapes↔paradas dentro de lo esperado.");
