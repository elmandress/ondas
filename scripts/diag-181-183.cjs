// Diagnóstico F1.1: ¿cómo modela el GTFS las líneas 181/183 (y un circular)?
// ¿Hay UNA variante que cubra un through-route, o están truncadas?
const Database = require("better-sqlite3");
const fs = require("fs");
const db = new Database("data/gtfs-v2.db", { readonly: true });
const stops = JSON.parse(fs.readFileSync("public/stops.json", "utf8"));
const name = new Map(stops.map((s) => [String(s.stopId), s.stopName]));

function variantsOf(line) {
  return db.prepare("SELECT variant_id, headsign, direction_id FROM variants WHERE short_name = ?").all(line);
}
function stopsOf(vid) {
  return db.prepare("SELECT stop_sequence, stop_id FROM variant_stops WHERE variant_id = ? ORDER BY stop_sequence").all(vid);
}

for (const line of ["181", "183", "CA1", "D1", "14"]) {
  const vs = variantsOf(line);
  console.log(`\n=== Línea ${line}: ${vs.length} variantes ===`);
  for (const v of vs) {
    const ss = stopsOf(v.variant_id);
    const first = ss[0] ? name.get(String(ss[0].stop_id)) || ss[0].stop_id : "?";
    const last = ss[ss.length - 1] ? name.get(String(ss[ss.length - 1].stop_id)) || ss[ss.length - 1].stop_id : "?";
    console.log(`  v=${v.variant_id} dir=${v.direction_id} headsign="${v.headsign}" stops=${ss.length}`);
    console.log(`     [${first}]  →  [${last}]`);
  }
}

// ¿Alguna variante de 183 contiene a la vez una parada del Centro y una de la zona Pocitos/Buceo/Carrasco?
console.log("\n=== ¿La 183 cubre Centro→zona costera en UNA variante? ===");
function findStopIdsByName(re) {
  return stops.filter((s) => re.test(s.stopName)).map((s) => String(s.stopId));
}
const centro = new Set(findStopIdsByName(/18 DE JULIO/i));
const costa = new Set(findStopIdsByName(/26 DE MARZO|PORTONES|MONTEVIDEO SHOPPING|RIVERA Y|AV ITALIA/i));
for (const line of ["181", "183"]) {
  for (const v of variantsOf(line)) {
    const ss = stopsOf(v.variant_id);
    const seqC = ss.find((x) => centro.has(String(x.stop_id)));
    const seqK = ss.find((x) => costa.has(String(x.stop_id)));
    if (seqC && seqK) {
      console.log(`  ${line} v=${v.variant_id}: Centro(seq ${seqC.stop_sequence}) y Costa(seq ${seqK.stop_sequence}) → ${seqC.stop_sequence < seqK.stop_sequence ? "MISMA VARIANTE, EN ORDEN ✅ directo" : "presentes pero fuera de orden"}`);
    }
  }
}
console.log("(si no imprime nada arriba: NINGUNA variante cubre el through-route → ahí está el problema)");
