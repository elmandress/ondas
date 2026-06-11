/**
 * PG-3: preserva el merge METROPOLITANO (prefijo "M") a través de una regeneración
 * del GTFS de MVD, sin necesitar la fuente original (tmp_nac/, que no siempre está).
 *
 * Por qué: build-gtfs-db.mjs crea data/gtfs-v2.db DESDE CERO y build-stops-json.mjs
 * sobreescribe public/stops.json → el merge metro (merge-metro-gtfs.mjs) se pierde.
 * Cuando solo se actualiza el GTFS de MVD (el feed metro no cambió), lo correcto es
 * snapshotear las filas "M" existentes y re-inyectarlas idénticas tras el rebuild.
 * Si el feed METRO también cambió, correr el merge-metro-gtfs.mjs original con tmp_nac.
 *
 * Uso (en orden, dentro de la regeneración):
 *   node scripts/pipeline/preserve-metro.mjs --snapshot   → tmp_metro_snapshot.json
 *   node scripts/build-gtfs-db.mjs <gtfsDir> data/gtfs-v2.db
 *   node scripts/build-stops-json.mjs <gtfsDir> public/stops.json
 *   node scripts/pipeline/preserve-metro.mjs --restore    → re-inyecta db + stops.json
 *   node scripts/export-gtfs-json.mjs                     → (después del restore!)
 */
import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

const ROOT = process.cwd();
const DB_PATH = path.join(ROOT, "data", "gtfs-v2.db");
const STOPS_PATH = path.join(ROOT, "public", "stops.json");
const SNAP_PATH = path.join(ROOT, "tmp_metro_snapshot.json");

const mode = process.argv[2];

if (mode === "--snapshot") {
  const db = new Database(DB_PATH, { readonly: true });
  const variants = db.prepare("SELECT * FROM variants WHERE variant_id LIKE 'M%'").all();
  const variantStops = db.prepare("SELECT * FROM variant_stops WHERE variant_id LIKE 'M%'").all();
  db.close();

  const stops = JSON.parse(fs.readFileSync(STOPS_PATH, "utf-8"));
  const metroStops = stops.filter((s) => String(s.stopId).startsWith("M"));

  if (variants.length === 0 || metroStops.length === 0) {
    console.error("✗ No hay datos metro (M) para snapshotear — ¿ya se perdieron? Abortando.");
    process.exit(1);
  }
  fs.writeFileSync(SNAP_PATH, JSON.stringify({ variants, variantStops, metroStops }));
  console.log(`[metro] snapshot: ${variants.length} variantes · ${variantStops.length} variant_stops · ${metroStops.length} paradas → ${path.basename(SNAP_PATH)}`);
} else if (mode === "--restore") {
  if (!fs.existsSync(SNAP_PATH)) {
    console.error("✗ No existe el snapshot — correr --snapshot ANTES de regenerar.");
    process.exit(1);
  }
  const { variants, variantStops, metroStops } = JSON.parse(fs.readFileSync(SNAP_PATH, "utf-8"));

  // 1. DB: re-inyectar variantes y paradas-de-variante metro (idempotente).
  const db = new Database(DB_PATH);
  db.exec("BEGIN");
  db.prepare("DELETE FROM variants WHERE variant_id LIKE 'M%'").run();
  db.prepare("DELETE FROM variant_stops WHERE variant_id LIKE 'M%'").run();
  const vCols = Object.keys(variants[0]);
  const insV = db.prepare(`INSERT INTO variants (${vCols.join(",")}) VALUES (${vCols.map((c) => "@" + c).join(",")})`);
  for (const v of variants) insV.run(v);
  const sCols = Object.keys(variantStops[0]);
  const insS = db.prepare(`INSERT INTO variant_stops (${sCols.join(",")}) VALUES (${sCols.map((c) => "@" + c).join(",")})`);
  for (const s of variantStops) insS.run(s);
  db.exec("COMMIT");
  db.close();

  // 2. stops.json: re-agregar las paradas metro (sin duplicar por si ya están).
  const stops = JSON.parse(fs.readFileSync(STOPS_PATH, "utf-8"));
  const existing = new Set(stops.map((s) => String(s.stopId)));
  let added = 0;
  for (const ms of metroStops) {
    if (!existing.has(String(ms.stopId))) { stops.push(ms); added++; }
  }
  fs.writeFileSync(STOPS_PATH, JSON.stringify(stops));

  console.log(`[metro] restore: ${variants.length} variantes y ${variantStops.length} variant_stops a la db · +${added} paradas a stops.json (total ${stops.length})`);
  console.log("[metro] recordar: correr export-gtfs-json.mjs DESPUÉS de este restore.");
} else {
  console.error("Uso: preserve-metro.mjs --snapshot | --restore");
  process.exit(1);
}
