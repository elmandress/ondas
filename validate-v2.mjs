import Database from "better-sqlite3";
import fs from "fs";

const db = new Database("data/gtfs-v2.db", { readonly: true });
const out = [];
const log = (...a) => out.push(a.join(" "));

// 1. Totales
const vc = db.prepare("SELECT COUNT(*) c FROM variants").get().c;
const sc = db.prepare("SELECT COUNT(*) c FROM variant_stops").get().c;
log(`variants=${vc} variant_stops=${sc}`);

// 2. Línea 76 — debería tener ~9 variants ahora
const v76 = db.prepare("SELECT variant_id, headsign, all_headsigns, direction_id FROM variants WHERE short_name='76' ORDER BY variant_id").all();
log(`\n=== LÍNEA 76: ${v76.length} variants (antes: 2) ===`);
for (const v of v76) {
  const n = db.prepare("SELECT COUNT(*) c, MIN(stop_sequence) mn, MAX(stop_sequence) mx FROM variant_stops WHERE variant_id=?").get(v.variant_id);
  log(`  ${v.variant_id} | dir${v.direction_id} | ${n.c} paradas (seq ${n.mn}..${n.mx}) | ${v.headsign}`);
}

// 3. ¿stop_sequence contiguo 1..N en TODAS las variants?
const variants = db.prepare("SELECT variant_id FROM variants").all();
let badContig = 0;
for (const v of variants) {
  const seqs = db.prepare("SELECT stop_sequence FROM variant_stops WHERE variant_id=? ORDER BY stop_sequence").all(v.variant_id).map((r) => r.stop_sequence);
  if (seqs[0] !== 1) { badContig++; continue; }
  for (let i = 1; i < seqs.length; i++) if (seqs[i] !== seqs[i - 1] + 1) { badContig++; break; }
}
log(`\nvariants con stop_sequence NO contiguo 1..N: ${badContig} (debe ser 0)`);

// 4. arrival_seconds poblado
const arr = db.prepare("SELECT SUM(CASE WHEN arrival_seconds>0 THEN 1 ELSE 0 END) pop, COUNT(*) t FROM variant_stops").get();
log(`arrival_seconds>0: ${arr.pop}/${arr.t} (${(100*arr.pop/arr.t).toFixed(1)}%)`);

// 5. Spot check: ¿una parada de PORTONES (corto) NO está en variante larga?
//    Verificamos que distintas variants de 76 tienen distintas paradas finales
log(`\n=== Paradas finales distintas por variante 76 (prueba de no-colapso) ===`);
const finals = new Set();
for (const v of v76) {
  const last = db.prepare("SELECT stop_id FROM variant_stops WHERE variant_id=? ORDER BY stop_sequence DESC LIMIT 1").get(v.variant_id);
  finals.add(last.stop_id);
  log(`  ${v.variant_id}: última parada stop_id=${last.stop_id}`);
}
log(`paradas finales DISTINTAS: ${finals.size} de ${v76.length} variants`);

// 6. variant_id format sanity — todos string no vacíos, únicos
const ids = variants.map((v) => v.variant_id);
log(`\nvariant_id únicos: ${new Set(ids).size}/${ids.length}`);

fs.writeFileSync("d:/tmp/validate-v2.txt", out.join("\n"));
console.log("written");
