/**
 * Fusiona el GTFS METROPOLITANO oficial (Canelones suburbano) dentro de
 * data/gtfs-v2.db y public/stops.json, para que el motor de ruteo F1 pueda
 * planificar viajes Montevideo ↔ Canelones SIN cambios en su lógica.
 *
 * Decisión (validada): una sola fuente de verdad. Las líneas metro (6R6, 6A…)
 * y casi todos los stop_id NO solapan con los de MVD; para los 7 que sí, y por
 * seguridad/trazabilidad, prefijamos TODOS los stop_id e ids de variante metro
 * con "M". Así un stop "M15001" es inequívocamente metropolitano.
 *
 * Idempotente: borra primero todo lo que haya entrado con prefijo "M".
 *
 * USO:
 *   1. tener data/gtfs-metro.db (node scripts/build-gtfs-db.mjs tmp_nac/gtfs data/gtfs-metro.db)
 *   2. tener tmp_nac/gtfs/stops.txt (del zip oficial) para las coordenadas
 *   3. node scripts/merge-metro-gtfs.mjs
 */
import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

const ROOT = process.cwd();
const MAIN_DB = path.join(ROOT, "data", "gtfs-v2.db");
const METRO_DB = path.join(ROOT, "data", "gtfs-metro.db");
const STOPS_JSON = path.join(ROOT, "public", "stops.json");
const STOPS_TXT = path.join(ROOT, "tmp_nac", "gtfs", "stops.txt");
const PREFIX = "M";

function parseCsvLine(line) {
  const res = []; let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQ = !inQ;
    else if (c === "," && !inQ) { res.push(cur); cur = ""; }
    else cur += c;
  }
  res.push(cur); return res;
}

// 1. Coordenadas de las paradas metro desde stops.txt (CRLF + algunas en lat/lon 0)
const stopsTxt = fs.readFileSync(STOPS_TXT, "utf8").replace(/\r/g, "");
const stLines = stopsTxt.split("\n").filter((l) => l.trim());
const stHeader = parseCsvLine(stLines[0]);
const ci = {
  id: stHeader.indexOf("stop_id"), code: stHeader.indexOf("stop_code"),
  name: stHeader.indexOf("stop_name"), lat: stHeader.indexOf("stop_lat"), lon: stHeader.indexOf("stop_lon"),
};
const metroStopCoords = new Map(); // stop_id (sin prefijo) -> {name, lat, lon, code}
for (let i = 1; i < stLines.length; i++) {
  const c = parseCsvLine(stLines[i]);
  const lat = parseFloat(c[ci.lat]), lon = parseFloat(c[ci.lon]);
  if (!isFinite(lat) || !isFinite(lon) || lat === 0 || lon === 0) continue; // filtrar paradas sin coords
  metroStopCoords.set(String(c[ci.id]), {
    name: (c[ci.name] || "").trim(), code: (c[ci.code] || c[ci.id]).trim(), lat, lon,
  });
}
console.log(`[merge] ${metroStopCoords.size} paradas metro con coordenadas válidas`);

// 2. Leer variantes y paradas del metro
const metro = new Database(METRO_DB, { readonly: true });
const metroVariants = metro.prepare("SELECT * FROM variants").all();
const metroStops = metro.prepare("SELECT * FROM variant_stops").all();
metro.close();

// 3. Insertar en la DB principal (con prefijo M), idempotente
const db = new Database(MAIN_DB);
db.pragma("journal_mode = WAL");
// limpiar lo previo con prefijo M
db.prepare(`DELETE FROM variants WHERE variant_id LIKE '${PREFIX}-%'`).run();
db.prepare(`DELETE FROM variant_stops WHERE variant_id LIKE '${PREFIX}-%'`).run();

const insV = db.prepare("INSERT INTO variants VALUES (@variant_id,@short_name,@headsign,@all_headsigns,@long_name,@direction_id)");
const insS = db.prepare("INSERT INTO variant_stops VALUES (@variant_id,@stop_sequence,@stop_id,@arrival_seconds)");

// solo insertamos paradas cuyo stop tiene coords (si no, el motor no las puede geolocalizar)
let insertedV = 0, insertedS = 0, skippedNoCoord = 0;
db.transaction(() => {
  for (const v of metroVariants) {
    insV.run({ ...v, variant_id: `${PREFIX}-${v.variant_id}` });
    insertedV++;
  }
  for (const s of metroStops) {
    if (!metroStopCoords.has(String(s.stop_id))) { skippedNoCoord++; continue; }
    insS.run({ ...s, variant_id: `${PREFIX}-${s.variant_id}`, stop_id: `${PREFIX}${s.stop_id}` });
    insertedS++;
  }
})();
db.exec("ANALYZE");
db.close();
console.log(`[merge] insertadas ${insertedV} variantes, ${insertedS} paradas (${skippedNoCoord} saltadas sin coords)`);

// 4. Agregar las paradas metro a public/stops.json (con prefijo M, dedup)
const stopsJson = JSON.parse(fs.readFileSync(STOPS_JSON, "utf8"));
const arr = Array.isArray(stopsJson) ? stopsJson : (stopsJson.stops || Object.values(stopsJson));
const existing = new Set(arr.map((s) => String(s.stopId)));

// líneas por parada metro (para el campo lines)
const linesByStop = new Map();
const metro2 = new Database(METRO_DB, { readonly: true });
const rows = metro2.prepare(`
  SELECT vs.stop_id, v.short_name
  FROM variant_stops vs JOIN variants v ON vs.variant_id = v.variant_id
`).all();
metro2.close();
for (const r of rows) {
  const k = String(r.stop_id);
  if (!linesByStop.has(k)) linesByStop.set(k, new Set());
  linesByStop.get(k).add(r.short_name);
}

let added = 0;
for (const [rawId, coord] of metroStopCoords) {
  const id = `${PREFIX}${rawId}`;
  if (existing.has(id)) continue;
  const lines = [...(linesByStop.get(rawId) || [])].sort();
  if (lines.length === 0) continue; // parada sin servicio en el feed → no la mostramos
  arr.push({
    stopId: id, stopCode: coord.code, stopName: coord.name,
    stopLat: coord.lat, stopLon: coord.lon, lines, metro: true,
  });
  existing.add(id); added++;
}
fs.writeFileSync(STOPS_JSON, JSON.stringify(arr));
console.log(`[merge] stops.json: +${added} paradas metro (total ${arr.length})`);
console.log("[merge] OK");
