/**
 * Exporta data/gtfs-v2.db → data/gtfs-v2.json (índices listos para el planner).
 *
 * Por qué: better-sqlite3 es un módulo NATIVO de C++ que falla seguido en Netlify
 * Functions (no compila / el binario no carga / problemas de prebuilds en 12.x).
 * Resultado: las paradas/POIs (JSON puro) andan en prod, pero las RUTAS y recorridos
 * (que leían el .db con better-sqlite3) NO. Migrar a JSON elimina el módulo nativo del
 * hot-path → las rutas funcionan en prod igual que en local.
 *
 * El JSON trae 3 índices precomputados para que las consultas del planner sean O(1):
 *   - variantsByLine[shortName]  → variantes de una línea
 *   - stopsByVariant[variantId]  → paradas en orden de recorrido
 *   - variantsByStop[stopId]     → variantes que pasan por una parada
 *
 * Uso:  node scripts/export-gtfs-json.mjs   (regenerar cuando cambie gtfs-v2.db)
 */
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const DB = path.join(process.cwd(), "data", "gtfs-v2.db");
const OUT = path.join(process.cwd(), "data", "gtfs-v2.json");

const db = new Database(DB, { readonly: true, fileMustExist: true });

// ¿existe la columna all_headsigns? (v2 sí; v1 no)
const cols = db.prepare("PRAGMA table_info(variants)").all().map((c) => c.name);
const hasAll = cols.includes("all_headsigns");

const variantSelect = hasAll
  ? "variant_id, short_name, headsign, all_headsigns, direction_id"
  : "variant_id, short_name, headsign, direction_id";

console.log("Leyendo variants…");
const variants = db.prepare(`SELECT ${variantSelect} FROM variants`).all();

console.log("Leyendo variant_stops…");
const variantStops = db.prepare(
  "SELECT variant_id, stop_sequence, stop_id, arrival_seconds FROM variant_stops ORDER BY variant_id, stop_sequence"
).all();

db.close();

// ── Índice 1: variantsByLine ──
const variantsByLine = {};
const variantMeta = {}; // variant_id → {shortName, headsign, directionId}
for (const v of variants) {
  const meta = {
    variantId: v.variant_id,
    shortName: v.short_name,
    headsign: v.headsign || "",
    allHeadsigns: (hasAll ? v.all_headsigns : v.headsign) || v.headsign || "",
    directionId: v.direction_id,
  };
  (variantsByLine[v.short_name] ||= []).push(meta);
  variantMeta[v.variant_id] = meta;
}

// ── Índice 2: stopsByVariant (ordenado) ──
const stopsByVariant = {};
// ── Índice 3: variantsByStop ──
// Arrays compactos para ahorrar peso (sin repetir nombres de campo 100k veces).
//   stopsByVariant[vid] = [ [stopId, seq, arrSec], ... ]
//   variantsByStop[sid] = [ [variantId, seq], ... ]   (resto se deriva de variantMeta)
const variantsByStop = {};
for (const r of variantStops) {
  (stopsByVariant[r.variant_id] ||= []).push([r.stop_id, r.stop_sequence, r.arrival_seconds]);
  (variantsByStop[r.stop_id] ||= []).push([r.variant_id, r.stop_sequence]);
}

const out = { variantsByLine, stopsByVariant, variantsByStop, variantMeta };
fs.writeFileSync(OUT, JSON.stringify(out));
const mb = (fs.statSync(OUT).size / 1048576).toFixed(1);
console.log(`✅ ${OUT}  (${mb} MB)`);
console.log(`   líneas: ${Object.keys(variantsByLine).length}, variantes: ${variants.length}, variant_stops: ${variantStops.length}`);
