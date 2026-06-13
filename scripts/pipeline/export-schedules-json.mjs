/**
 * Exporta los horarios programados (schedule.db 84MB + metro-schedule.db 32MB,
 * SQLite) → data/sched/shard-{0..31}.json (JSON puro, bundleable a functions).
 *
 * POR QUÉ (R60): "próximos horarios" estaba MUERTO en producción. schedule.db no
 * se sube (84MB) y metro-schedule.db dependía de better-sqlite3 — módulo NATIVO
 * C++ que no carga en Netlify Functions (la misma causa por la que el GTFS migró
 * a JSON en R-deploy). Regla de arquitectura: todo dato en runtime = JSON via fs.
 *
 * Formato shard (compacto, lazy-load por parada en runtime):
 *   { [stopId]: { [tipoDia "1"|"2"|"3"]: { [LINEA_CANON]: "m1,m2,m3..." } } }
 *   - minutos del día ordenados asc (pueden superar 1440: corridas nocturnas del
 *     día operativo, igual que en SQLite).
 *   - línea CANÓNICA (canonLine) — el runtime busca canon, sin ambigüedad CE1/Ce1.
 *   - shard = hash(stopId) % 32 (mismo hash en runtime: shardOf()).
 *
 * USO: node scripts/pipeline/export-schedules-json.mjs
 * (re-correr cuando se regeneren schedule.db / metro-schedule.db)
 */
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "data", "sched");
const SHARDS = 32;

const canonLine = (s) => String(s).trim().replace(/\s+/g, " ").toUpperCase();
// Mismo hash que src/lib/schedule-db.ts (mantener sincronizados).
const shardOf = (stopId) => {
  let h = 0;
  const s = String(stopId);
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % SHARDS;
};

const variantToLine = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "variant_to_line.json"), "utf-8"));
const v2lCanon = {};
for (const [v, l] of Object.entries(variantToLine)) v2lCanon[v] = canonLine(l);

// shards[n][stopId][tipo][line] = Set<minutos>
const shards = Array.from({ length: SHARDS }, () => ({}));
function add(stopId, tipo, line, hora) {
  const sh = shards[shardOf(stopId)];
  const byTipo = (sh[stopId] ||= {});
  const byLine = (byTipo[tipo] ||= {});
  (byLine[line] ||= new Set()).add(hora);
}

// 1. Urbano: schedules(tipo_dia, cod_variante, parada, hora) — línea via variant_to_line
{
  const db = new Database(path.join(ROOT, "data", "schedule.db"), { readonly: true });
  let rows = 0, unmapped = 0;
  for (const r of db.prepare("SELECT tipo_dia, cod_variante, parada, hora FROM schedules").iterate()) {
    const line = v2lCanon[String(r.cod_variante)];
    if (!line) { unmapped++; continue; }
    add(String(r.parada), String(r.tipo_dia), line, r.hora);
    rows++;
  }
  db.close();
  console.log(`[urbano] ${rows} horarios exportados · ${unmapped} sin línea conocida (descartados)`);
}

// 2. Metro (Canelones): schedules(stop_id, line, tipo_dia, hora) — línea directa
{
  const db = new Database(path.join(ROOT, "data", "metro-schedule.db"), { readonly: true });
  let rows = 0;
  for (const r of db.prepare("SELECT stop_id, line, tipo_dia, hora FROM schedules").iterate()) {
    add(String(r.stop_id), String(r.tipo_dia), canonLine(r.line), r.hora);
    rows++;
  }
  db.close();
  console.log(`[metro] ${rows} horarios exportados`);
}

// 3. Escribir shards (sets → strings "m1,m2,..." ordenadas)
fs.mkdirSync(OUT_DIR, { recursive: true });
let totalBytes = 0, totalStops = 0;
for (let n = 0; n < SHARDS; n++) {
  const sh = shards[n];
  const out = {};
  for (const [stopId, byTipo] of Object.entries(sh)) {
    totalStops++;
    out[stopId] = {};
    for (const [tipo, byLine] of Object.entries(byTipo)) {
      out[stopId][tipo] = {};
      for (const [line, set] of Object.entries(byLine)) {
        out[stopId][tipo][line] = [...set].sort((a, b) => a - b).join(",");
      }
    }
  }
  const p = path.join(OUT_DIR, `shard-${n}.json`);
  fs.writeFileSync(p, JSON.stringify(out));
  totalBytes += fs.statSync(p).size;
}
console.log(`OK → ${SHARDS} shards · ${totalStops} paradas · ${(totalBytes / 1024 / 1024).toFixed(1)} MB total (vs 116 MB de SQLite)`);
