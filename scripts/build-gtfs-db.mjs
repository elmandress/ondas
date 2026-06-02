/**
 * Reconstruye data/gtfs.db desde el GTFS oficial de Montevideo preservando
 * TODOS los patrones de recorrido distintos (no colapsados por sentido).
 *
 * CONTEXTO DEL BUG QUE ARREGLA:
 *   La gtfs.db anterior colapsaba múltiples recorridos en un solo variant_id
 *   por sentido. Ej: línea 76 tiene 9 patrones de parada reales (CARRASCO,
 *   PASO CARRASCO, PORTONES, etc. que van por calles distintas) pero se
 *   guardaban como 2 variant_id. Resultado: buses mapeados al recorrido
 *   equivocado → paradas/ETA/polyline incorrectas, y buses-fantasma que
 *   nunca llegan (un "PORTONES SHOPPING" corto mapeado a la ruta larga).
 *
 * QUÉ HACE:
 *   1 variant_id por (short_name, direction_id, patrón-de-paradas único).
 *   Renumera stop_sequence a 1..N contiguo (el código asume esto).
 *   Guarda todos los headsigns vistos para ese patrón (para matching).
 *
 * USO:
 *   1. Bajar y extraer el GTFS oficial a un directorio (ver build-gtfs-download.mjs)
 *   2. node scripts/build-gtfs-db.mjs [gtfsDir] [outDb]
 *      defaults: gtfsDir=d:/tmp/gtfs-official  outDb=data/gtfs-v2.db
 *
 * Server-only / build-time. No se importa desde la app.
 */
import fs from "fs";
import readline from "readline";
import path from "path";
import Database from "better-sqlite3";

const GTFS_DIR = process.argv[2] || "d:/tmp/gtfs-official";
const OUT_DB = process.argv[3] || "data/gtfs-v2.db";

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
function readCsv(p) {
  const txt = fs.readFileSync(p, "utf8").replace(/^﻿/, "");
  const lines = txt.split(/\r?\n/).filter((l) => l.length);
  const header = parseCsvLine(lines[0]);
  return lines.slice(1).map((l) => {
    const cells = parseCsvLine(l); const o = {};
    header.forEach((h, i) => (o[h] = cells[i])); return o;
  });
}
/** "HH:MM:SS" (puede pasar de 24h) → segundos desde medianoche. */
function timeToSeconds(t) {
  if (!t) return 0;
  const m = t.split(":");
  if (m.length !== 3) return 0;
  return (+m[0]) * 3600 + (+m[1]) * 60 + (+m[2]);
}

console.log(`[build] leyendo GTFS de ${GTFS_DIR}`);

// 1. routes.txt
const routes = readCsv(path.join(GTFS_DIR, "routes.txt"));
const routeMeta = {};
for (const r of routes) routeMeta[r.route_id] = { short: r.route_short_name, long: r.route_long_name || "" };

// 2. trips.txt
const trips = readCsv(path.join(GTFS_DIR, "trips.txt"));
const tripMeta = {};
for (const t of trips) {
  const rm = routeMeta[t.route_id];
  if (!rm || rm.short == null || rm.short === "") continue;
  tripMeta[t.trip_id] = {
    short: rm.short, long: rm.long,
    dir: t.direction_id ?? "0",
    headsign: (t.trip_headsign || "").trim(),
  };
}
console.log(`[build] ${Object.keys(tripMeta).length} trips con línea conocida`);

// 3. stop_times.txt (stream) → tripId -> [{seq, stop_id, arr}]
const tripStops = new Map();
await new Promise((resolve) => {
  const rl = readline.createInterface({ input: fs.createReadStream(path.join(GTFS_DIR, "stop_times.txt")) });
  let header = null, idx = {};
  rl.on("line", (line) => {
    if (!header) {
      header = parseCsvLine(line.replace(/^﻿/, ""));
      idx = { trip: header.indexOf("trip_id"), seq: header.indexOf("stop_sequence"), stop: header.indexOf("stop_id"), arr: header.indexOf("arrival_time") };
      return;
    }
    const cells = parseCsvLine(line);
    const tid = cells[idx.trip];
    if (!tripMeta[tid]) return;
    let a = tripStops.get(tid);
    if (!a) { a = []; tripStops.set(tid, a); }
    a.push([parseInt(cells[idx.seq]), cells[idx.stop], timeToSeconds(cells[idx.arr])]);
  });
  rl.on("close", resolve);
});
console.log(`[build] ${tripStops.size} trips con paradas`);

// 4. Agrupar por patrón único (short|dir|signature)
const patterns = new Map(); // key -> { short, long, dir, stops:[[stop_id,arr]...], headsigns:Map<hs,count> }
for (const [tid, meta] of Object.entries(tripMeta)) {
  const stops = tripStops.get(tid);
  if (!stops || stops.length < 2) continue;
  stops.sort((a, b) => a[0] - b[0]);
  const sig = stops.map((s) => s[1]).join(">");
  const key = `${meta.short}|${meta.dir}|${sig}`;
  let p = patterns.get(key);
  if (!p) {
    p = { short: meta.short, long: meta.long, dir: meta.dir, stops: stops.map((s) => [s[1], s[2]]), headsigns: new Map() };
    patterns.set(key, p);
  }
  p.headsigns.set(meta.headsign, (p.headsigns.get(meta.headsign) || 0) + 1);
}
console.log(`[build] ${patterns.size} patrones de parada únicos`);

// 5. Asignar variant_id por (short, dir) incremental
const perLineDir = {};
const variantRows = []; // {variant_id, short, headsign, all_headsigns, long, dir}
const stopRows = [];    // {variant_id, seq, stop_id, arr}
for (const p of patterns.values()) {
  const ld = `${p.short}|${p.dir}`;
  perLineDir[ld] = (perLineDir[ld] || 0) + 1;
  const variant_id = `${p.short}-${p.dir}-${perLineDir[ld]}`;
  // headsign primario = el más frecuente
  const sortedHs = [...p.headsigns.entries()].sort((a, b) => b[1] - a[1]);
  const headsign = sortedHs[0]?.[0] || "";
  const allHs = sortedHs.map((h) => h[0]).filter(Boolean).join("|");
  variantRows.push({ variant_id, short: p.short, headsign, all_headsigns: allHs, long: p.long, dir: parseInt(p.dir) || 0 });
  p.stops.forEach((s, i) => stopRows.push({ variant_id, seq: i + 1, stop_id: s[0], arr: s[1] }));
}
console.log(`[build] ${variantRows.length} variants, ${stopRows.length} variant_stops`);

// 6. Escribir SQLite
if (fs.existsSync(OUT_DB)) fs.unlinkSync(OUT_DB);
const db = new Database(OUT_DB);
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE variants (
    variant_id TEXT, short_name TEXT, headsign TEXT,
    all_headsigns TEXT, long_name TEXT, direction_id INTEGER
  );
  CREATE TABLE variant_stops (
    variant_id TEXT, stop_sequence INTEGER, stop_id TEXT, arrival_seconds INTEGER
  );
`);
const insV = db.prepare("INSERT INTO variants VALUES (@variant_id,@short,@headsign,@all_headsigns,@long,@dir)");
const insS = db.prepare("INSERT INTO variant_stops VALUES (@variant_id,@seq,@stop_id,@arr)");
db.transaction(() => { for (const r of variantRows) insV.run(r); })();
db.transaction(() => { for (const r of stopRows) insS.run(r); })();
db.exec(`
  CREATE INDEX idx_vs_variant ON variant_stops(variant_id);
  CREATE INDEX idx_vs_stop ON variant_stops(stop_id);
  CREATE INDEX idx_v_short ON variants(short_name);
  CREATE INDEX idx_v_variant ON variants(variant_id);
`);
db.exec("ANALYZE");
db.close();
console.log(`[build] OK -> ${OUT_DB}`);
