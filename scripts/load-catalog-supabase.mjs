/**
 * Carga el CATÁLOGO de transporte a Supabase (paradas, líneas, operadores, stop_lines).
 *
 * Por qué: las features de cuenta (favoritos/rutas en la nube) y los reportes
 * referencian paradas/líneas por FK. Sin el catálogo cargado, esos upserts fallan
 * en silencio. Este script lo puebla desde public/stops.json + operators.json.
 *
 * Usa la SERVICE_ROLE key (bypassa RLS) → SOLO correr localmente/CI, nunca en el cliente.
 * Idempotente: usa upsert, se puede correr de nuevo sin duplicar.
 *
 * Uso:  node scripts/load-catalog-supabase.mjs
 *       (lee las env de .env.local)
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// ── cargar env de .env.local ──
const envFile = path.join(process.cwd(), ".env.local");
const env = Object.fromEntries(
  fs.readFileSync(envFile, "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) { console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local"); process.exit(1); }

const sb = createClient(URL, KEY, { auth: { persistSession: false } });
const BATCH = 1000;

async function upsertInBatches(table, rows, conflict) {
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const { error } = await sb.from(table).upsert(chunk, { onConflict: conflict, ignoreDuplicates: false });
    if (error) { console.error(`  ✗ ${table} lote ${i}:`, error.message); throw error; }
    process.stdout.write(`\r  ${table}: ${Math.min(i + BATCH, rows.length)}/${rows.length}`);
  }
  process.stdout.write("\n");
}

async function main() {
  console.log("Cargando catálogo a Supabase…\n");

  // ── 1. Operadores + líneas (de operators.json: byLine[lineCode] = {empresa, web}) ──
  const operators = JSON.parse(fs.readFileSync("public/operators.json", "utf8"));
  const byLine = operators.byLine || {};
  const empresaSet = new Map(); // nombre → web
  for (const code in byLine) {
    const o = byLine[code];
    if (o.empresa && !empresaSet.has(o.empresa)) empresaSet.set(o.empresa, o.web || null);
  }
  const operatorRows = [...empresaSet].map(([name, website]) => ({ name, website }));
  console.log(`1. Operadores: ${operatorRows.length}`);
  await upsertInBatches("operators", operatorRows, "name");

  // mapa nombre→id para FK de líneas
  const { data: opData } = await sb.from("operators").select("id, name");
  const opId = Object.fromEntries((opData || []).map((o) => [o.name, o.id]));

  // ── 2. Líneas (short_name únicos de stops.json) + su operador (de byLine) ──
  const stops = JSON.parse(fs.readFileSync("public/stops.json", "utf8"));
  const lineSet = new Set();
  for (const s of stops) for (const l of (s.lines || [])) lineSet.add(l);
  // operador por línea: byLine está keyado por cod_variante, no short_name → mapeamos
  // por el primer match de empresa que tenga esa línea como prefijo (aproximado).
  const lineRows = [...lineSet].map((short_name) => ({ short_name }));
  console.log(`2. Líneas: ${lineRows.length}`);
  await upsertInBatches("lines", lineRows, "short_name");

  const { data: lineData } = await sb.from("lines").select("id, short_name");
  const lineId = Object.fromEntries((lineData || []).map((l) => [l.short_name, l.id]));

  // ── 3. Paradas (geom como WKT POINT lon lat) ──
  const stopRows = stops.map((s) => ({
    stop_id: s.stopId,
    stop_code: s.stopCode || s.stopId,
    name: s.stopName,
    // PostGIS acepta EWKT 'SRID=4326;POINT(lon lat)' al insertar en geography.
    geom: `SRID=4326;POINT(${s.stopLon} ${s.stopLat})`,
    source: s.stopId.startsWith("int-") ? "interior_crowdsource" : "gtfs",
  }));
  console.log(`3. Paradas: ${stopRows.length}`);
  await upsertInBatches("stops", stopRows, "stop_id");

  // ── 4. stop_lines (N:M) ──
  const stopLineRows = [];
  for (const s of stops) {
    for (const l of (s.lines || [])) {
      const lid = lineId[l];
      if (lid) stopLineRows.push({ stop_id: s.stopId, line_id: lid });
    }
  }
  console.log(`4. stop_lines: ${stopLineRows.length}`);
  await upsertInBatches("stop_lines", stopLineRows, "stop_id,line_id");

  // ── verificación ──
  const { count: stopCount } = await sb.from("stops").select("*", { count: "exact", head: true });
  const { count: lineCount } = await sb.from("lines").select("*", { count: "exact", head: true });
  console.log(`\n✅ Listo. stops=${stopCount}, lines=${lineCount}`);
}

main().catch((e) => { console.error("\n✗ Falló:", e.message); process.exit(1); });
