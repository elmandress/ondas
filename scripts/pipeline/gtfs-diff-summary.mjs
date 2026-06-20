/**
 * Resumen semántico del cambio de GTFS para el cuerpo del PR de auto-regeneración.
 * Compara los datasets REGENERADOS (working tree) contra los de `HEAD` (git) y reporta
 * cuántas paradas/líneas se agregaron o eliminaron — la señal que un humano necesita para
 * decidir si el cambio es rutina o un cambio grande que hay que mirar antes de mergear.
 *
 * Uso: node scripts/pipeline/gtfs-diff-summary.mjs   (imprime markdown a stdout)
 * No falla nunca (best-effort): si falta el HEAD previo, reporta "sin baseline".
 */
import { execSync } from "child_process";
import fs from "fs";

function readHead(path) {
  try { return JSON.parse(execSync(`git show HEAD:${path}`, { encoding: "utf-8", maxBuffer: 256 * 1024 * 1024 })); }
  catch { return null; }
}
function readDisk(path) {
  try { return JSON.parse(fs.readFileSync(path, "utf-8")); }
  catch { return null; }
}

function stopIds(stops) {
  const arr = Array.isArray(stops) ? stops : stops?.stops || [];
  return new Set(arr.map((s) => String(s.stopId)));
}
function diffSets(oldSet, newSet) {
  const added = [...newSet].filter((x) => !oldSet.has(x));
  const removed = [...oldSet].filter((x) => !newSet.has(x));
  return { added, removed };
}

const lines = [];
lines.push("## Resumen del cambio de GTFS\n");

// Versión
const newMeta = readDisk("data/gtfs-v2.json")?.meta;
const oldMeta = readHead("data/gtfs-v2.json")?.meta;
lines.push(`- **Versión**: \`${oldMeta?.gtfs_version ?? "?"}\` → \`${newMeta?.gtfs_version ?? "?"}\`\n`);

// Paradas
const oldStops = readHead("public/stops.json");
const newStops = readDisk("public/stops.json");
if (oldStops && newStops) {
  const { added, removed } = diffSets(stopIds(oldStops), stopIds(newStops));
  lines.push(`- **Paradas**: +${added.length} nuevas · −${removed.length} eliminadas`);
  if (removed.length) lines.push(`  - ⚠️ eliminadas (muestra): ${removed.slice(0, 15).join(", ")}${removed.length > 15 ? "…" : ""}`);
  lines.push("");
} else {
  lines.push("- **Paradas**: sin baseline para comparar\n");
}

// Líneas
const oldG = readHead("data/gtfs-v2.json");
const newG = readDisk("data/gtfs-v2.json");
if (oldG?.variantsByLine && newG?.variantsByLine) {
  const oldL = new Set(Object.keys(oldG.variantsByLine));
  const newL = new Set(Object.keys(newG.variantsByLine));
  const { added, removed } = diffSets(oldL, newL);
  lines.push(`- **Líneas**: +${added.length} nuevas · −${removed.length} eliminadas`);
  if (added.length) lines.push(`  - nuevas: ${added.slice(0, 20).join(", ")}${added.length > 20 ? "…" : ""}`);
  if (removed.length) lines.push(`  - ⚠️ eliminadas: ${removed.slice(0, 20).join(", ")}${removed.length > 20 ? "…" : ""}`);
  lines.push("");
} else {
  lines.push("- **Líneas**: sin baseline para comparar\n");
}

lines.push("> ⚠️ Revisar antes de mergear: paradas/líneas eliminadas pueden dejar páginas SEO huérfanas o cambiar recorridos que usan los motores de honestidad. Merge MANUAL.");
process.stdout.write(lines.join("\n") + "\n");
