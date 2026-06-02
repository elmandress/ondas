/**
 * Genera public/stops.json (paradas STM de Montevideo) desde el GTFS oficial:
 * id, código, nombre, coords + las líneas que pasan por cada parada.
 * Después merge-metro-gtfs.mjs le suma las paradas metropolitanas.
 *
 * USO: node scripts/build-stops-json.mjs [gtfsDir] [outJson]
 *   defaults: gtfsDir=tmp_gtfs  outJson=public/stops.json
 */
import fs from "fs";
import readline from "readline";
import path from "path";

const GTFS = process.argv[2] || "tmp_gtfs";
const OUT = process.argv[3] || "public/stops.json";
const BOM = /^﻿/;

function pc(line) {
  const r = []; let c = "", q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === "," && !q) { r.push(c); c = ""; }
    else c += ch;
  }
  r.push(c); return r;
}
function readCsv(p) {
  const t = fs.readFileSync(p, "utf8").replace(BOM, "").replace(/\r/g, "");
  const ls = t.split("\n").filter((l) => l.length);
  const h = pc(ls[0]);
  return ls.slice(1).map((l) => {
    const c = pc(l); const o = {};
    h.forEach((k, i) => { o[k] = (c[i] || "").replace(/^"|"$/g, ""); });
    return o;
  });
}

// routes → línea por route_id ; trips → route_id por trip_id
const routeShort = {};
for (const r of readCsv(path.join(GTFS, "routes.txt"))) routeShort[r.route_id] = r.route_short_name;
const tripRoute = {};
for (const t of readCsv(path.join(GTFS, "trips.txt"))) tripRoute[t.trip_id] = t.route_id;

// stop_times (stream) → líneas por stop_id
const linesByStop = new Map();
await new Promise((resolve) => {
  const rl = readline.createInterface({ input: fs.createReadStream(path.join(GTFS, "stop_times.txt")) });
  let header = null, iTrip = -1, iStop = -1;
  rl.on("line", (line) => {
    if (!header) { header = pc(line.replace(BOM, "")); iTrip = header.indexOf("trip_id"); iStop = header.indexOf("stop_id"); return; }
    const c = pc(line);
    const short = routeShort[tripRoute[c[iTrip]]];
    if (!short) return;
    const sid = c[iStop];
    if (!linesByStop.has(sid)) linesByStop.set(sid, new Set());
    linesByStop.get(sid).add(short);
  });
  rl.on("close", resolve);
});

const stops = [];
for (const s of readCsv(path.join(GTFS, "stops.txt"))) {
  const lat = parseFloat(s.stop_lat), lon = parseFloat(s.stop_lon);
  if (!isFinite(lat) || !isFinite(lon)) continue;
  const lines = [...(linesByStop.get(s.stop_id) || [])].sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
  stops.push({
    stopId: s.stop_id,
    stopCode: s.stop_code || s.stop_id,
    stopName: s.stop_name,
    stopLat: lat, stopLon: lon,
    lines,
  });
}

fs.writeFileSync(OUT, JSON.stringify(stops));
console.log(`[stops] ${stops.length} paradas STM → ${OUT}`);
