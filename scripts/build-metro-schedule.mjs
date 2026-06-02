/**
 * Construye data/metro-schedule.db: horarios de paso REALES por (parada, línea) de las
 * líneas metropolitanas, derivados del GTFS metro. Equivalente a schedule.db pero para
 * Canelones (schedule.db solo cubre Montevideo → las paradas metro marcaban "sin horario").
 *
 * Método: por cada trip, hora_salida (primera parada con arrival_time) + offset
 * interpolado a cada parada = hora de paso de ESE servicio por ESA parada. Agrupamos
 * por (stop_id, service_id) las horas, por línea.
 *
 * Schema: schedules(stop_id TEXT, line TEXT, tipo_dia INTEGER, hora INTEGER)  -- hora=min del día
 *   tipo_dia: 1=hábil, 2=sábado, 3=domingo (igual que schedule.db de MVD).
 *
 * USO: node scripts/build-metro-schedule.mjs tmp_nac/g data/metro-schedule.db
 */
import fs from "fs";
import readline from "readline";
import path from "path";
import Database from "better-sqlite3";

const GTFS = process.argv[2] || "tmp_nac/g";
const OUT = process.argv[3] || "data/metro-schedule.db";
const PREFIX = "M"; // stop_id en la app llevan prefijo M

function pc(line) { const r = []; let c = "", q = false; for (const ch of line) { if (ch === '"') q = !q; else if (ch === "," && !q) { r.push(c); c = ""; } else c += ch; } r.push(c); return r; }
function readCsv(p) { const t = fs.readFileSync(p, "utf8").replace(/\r/g, "").replace(/^﻿/, ""); const ls = t.split("\n").filter((l) => l.length); const h = pc(ls[0]).map((x) => x.replace(/"/g, "")); return ls.slice(1).map((l) => { const c = pc(l); const o = {}; h.forEach((k, i) => (o[k] = (c[i] || "").replace(/^"|"$/g, ""))); return o; }); }
function toSec(t) { if (!t) return null; const m = t.split(":"); if (m.length !== 3) return null; return (+m[0]) * 3600 + (+m[1]) * 60 + (+m[2]); }

// routes → línea; trips → {linea, service_id}
const routeShort = {};
for (const r of readCsv(path.join(GTFS, "routes.txt"))) routeShort[r.route_id] = r.route_short_name;
const tripInfo = {};
for (const t of readCsv(path.join(GTFS, "trips.txt"))) {
  const sn = routeShort[t.route_id];
  if (sn) tripInfo[t.trip_id] = { line: sn, service: t.service_id };
}
// calendar → service_id → tipo_dia (1 hábil / 2 sábado / 3 domingo)
const serviceTipo = {};
for (const c of readCsv(path.join(GTFS, "calendar.txt"))) {
  // hábil si corre L-V; sábado si sábado; domingo si domingo
  if (c.monday === "1") serviceTipo[c.service_id] = 1;
  else if (c.saturday === "1") serviceTipo[c.service_id] = 2;
  else if (c.sunday === "1") serviceTipo[c.service_id] = 3;
  else serviceTipo[c.service_id] = 1;
}

// stop_times por trip con interpolación (igual que build-metro-interpolated)
const tripStops = new Map();
await new Promise((resolve) => {
  const rl = readline.createInterface({ input: fs.createReadStream(path.join(GTFS, "stop_times.txt")) });
  let header = null, idx = {};
  rl.on("line", (line) => {
    if (!header) { header = pc(line.replace(/^﻿/, "")).map((x) => x.replace(/"/g, "")); idx = { trip: header.indexOf("trip_id"), seq: header.indexOf("stop_sequence"), stop: header.indexOf("stop_id"), arr: header.indexOf("arrival_time") }; return; }
    const c = pc(line); const tid = (c[idx.trip] || "").replace(/"/g, "");
    if (!tripInfo[tid]) return;
    let a = tripStops.get(tid); if (!a) { a = []; tripStops.set(tid, a); }
    a.push([parseInt(c[idx.seq]), (c[idx.stop] || "").replace(/"/g, ""), toSec((c[idx.arr] || "").replace(/"/g, ""))]);
  });
  rl.on("close", resolve);
});

function interpolate(stops) {
  stops.sort((a, b) => a[0] - b[0]);
  const known = stops.map((s, i) => (s[2] != null ? i : -1)).filter((i) => i >= 0);
  if (known.length === 0) return false; // sin hora real → no podemos ubicar en el día
  const first = known[0];
  for (let i = first - 1; i >= 0; i--) stops[i][2] = stops[i + 1][2] - 90;
  for (let k = 0; k < known.length - 1; k++) {
    const a = known[k], b = known[k + 1], t0 = stops[a][2], t1 = stops[b][2];
    for (let i = a + 1; i < b; i++) stops[i][2] = Math.round(t0 + ((t1 - t0) * (i - a)) / (b - a));
  }
  const last = known[known.length - 1];
  for (let i = last + 1; i < stops.length; i++) stops[i][2] = stops[i - 1][2] + 90;
  return true;
}

const rows = []; // {stop_id, line, tipo_dia, hora(min)}
let skipped = 0;
for (const [tid, info] of Object.entries(tripInfo)) {
  const stops = tripStops.get(tid);
  if (!stops || stops.length < 2) { skipped++; continue; }
  if (!interpolate(stops)) { skipped++; continue; }
  const tipo = serviceTipo[info.service] || 1;
  for (const s of stops) {
    const min = Math.round(s[2] / 60); // segundos del día → minutos del día
    if (min < 0 || min > 1800) continue;
    rows.push({ stop_id: PREFIX + s[1], line: info.line, tipo_dia: tipo, hora: min });
  }
}

if (fs.existsSync(OUT)) fs.unlinkSync(OUT);
const db = new Database(OUT); db.pragma("journal_mode = WAL");
db.exec("CREATE TABLE schedules (stop_id TEXT, line TEXT, tipo_dia INTEGER, hora INTEGER);");
const ins = db.prepare("INSERT INTO schedules VALUES (@stop_id,@line,@tipo_dia,@hora)");
db.transaction(() => { for (const r of rows) ins.run(r); })();
db.exec("CREATE INDEX idx_stop_dia ON schedules(stop_id, tipo_dia, hora); ANALYZE;");
db.close();
console.log(`[metro-schedule] ${rows.length} horarios de paso (${skipped} trips sin hora) → ${OUT}`);
