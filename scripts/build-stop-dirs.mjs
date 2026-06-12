/**
 * Genera public/stop-dirs.json: pista de SENTIDO para paradas con nombre DUPLICADO.
 *
 * Problema (auditoría R55/R58): "Basilea – Av Juan M Ferrari" aparece 2 veces en
 * Buscar (#3301 y #3302, una por sentido) sin forma de distinguirlas. La pista es el
 * headsign dominante de las variantes que sirven cada parada: "hacia Portones" vs
 * "hacia Ciudad Vieja".
 *
 * Solo incluye paradas cuyo nombre está repetido (mantiene el archivo chico) y solo
 * cuando el headsign dominante DIFIERE entre las duplicadas (si ambas dicen lo mismo,
 * la pista no desambigua y es ruido).
 *
 * Fuente: data/gtfs-v2.json + public/stops.json (ya generados por el pipeline).
 * USO: node scripts/build-stop-dirs.mjs   (correr después de regenerar el GTFS)
 */
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const gtfs = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "gtfs-v2.json"), "utf-8"));
const stops = JSON.parse(fs.readFileSync(path.join(ROOT, "public", "stops.json"), "utf-8"));
const OUT = path.join(ROOT, "public", "stop-dirs.json");

// Nombres duplicados
const byName = new Map();
for (const s of stops) {
  const k = s.stopName.trim().toLowerCase();
  if (!byName.has(k)) byName.set(k, []);
  byName.get(k).push(s.stopId);
}
const dupIds = new Set();
for (const ids of byName.values()) if (ids.length > 1) for (const id of ids) dupIds.add(String(id));

// Headsign dominante por parada (la variante con más presencia define el sentido)
function dominantHeadsign(stopId) {
  const vars = gtfs.variantsByStop[stopId];
  if (!vars || !vars.length) return null;
  const count = new Map();
  for (const [vid] of vars) {
    const h = gtfs.variantMeta[vid]?.headsign?.trim();
    if (!h) continue;
    count.set(h, (count.get(h) || 0) + 1);
  }
  if (!count.size) return null;
  return [...count.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

const dirs = {};
let kept = 0;
for (const ids of byName.values()) {
  if (ids.length < 2) continue;
  const hs = ids.map((id) => ({ id: String(id), h: dominantHeadsign(String(id)) }));
  // Si todas las duplicadas tienen el MISMO headsign dominante, la pista no sirve.
  const distinct = new Set(hs.map((x) => x.h).filter(Boolean));
  if (distinct.size < 2) continue;
  for (const { id, h } of hs) {
    if (h) { dirs[id] = h; kept++; }
  }
}

fs.writeFileSync(OUT, JSON.stringify(dirs));
const kb = (fs.statSync(OUT).size / 1024).toFixed(1);
console.log(`stop-dirs.json: ${kept} paradas con pista de sentido (de ${dupIds.size} con nombre duplicado) · ${kb} KB`);
