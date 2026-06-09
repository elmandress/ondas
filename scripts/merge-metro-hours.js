/**
 * Cierra el hueco suburbano de line-hours.json: agrega las líneas metropolitanas
 * (700/800/214/…) desde data/metro-schedule.db (line, tipo_dia, hora=min del día).
 *
 * ADITIVO y seguro: NO toca las líneas que ya tienen dato (las 143 STM quedan idénticas);
 * solo agrega las faltantes. Mismo formato de bitset (96 cuartos, base64) que build-line-hours.js.
 */
const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");

const LH_PATH = path.join(__dirname, "..", "data", "line-hours.json");
const METRO_PATH = path.join(__dirname, "..", "data", "metro-schedule.db");

function bitsetToBase64(bits) {
  return Buffer.from(bits).toString("base64");
}

function main() {
  const before = JSON.parse(fs.readFileSync(LH_PATH, "utf-8"));
  const beforeKeys = new Set(Object.keys(before));
  const db = new Database(METRO_PATH, { readonly: true });

  const lines = db.prepare("SELECT DISTINCT line FROM schedules").all().map((r) => String(r.line));
  let added = 0;
  const result = { ...before };

  for (const line of lines) {
    if (beforeKeys.has(line)) continue; // NO sobrescribir lo existente
    const byTipo = {};
    for (const tipo of [1, 2, 3]) {
      const bits = new Uint8Array(12);
      const rows = db.prepare("SELECT DISTINCT hora FROM schedules WHERE line = ? AND tipo_dia = ?").all(line, tipo);
      for (const r of rows) {
        const minOfDay = ((r.hora % 1440) + 1440) % 1440;
        const q = Math.floor(minOfDay / 15);
        bits[Math.floor(q / 8)] |= 1 << (q % 8);
      }
      if (rows.length) byTipo[tipo] = bitsetToBase64(bits);
    }
    if (byTipo[1] || byTipo[2] || byTipo[3]) {
      result[line] = byTipo;
      added++;
    }
  }
  db.close();

  // Verificación de integridad: las claves originales no deben cambiar.
  let changed = 0;
  for (const k of beforeKeys) {
    if (JSON.stringify(before[k]) !== JSON.stringify(result[k])) changed++;
  }
  if (changed > 0) { console.error("ABORT: " + changed + " líneas existentes cambiaron"); process.exit(1); }

  fs.writeFileSync(LH_PATH, JSON.stringify(result));
  const sizeKB = (fs.statSync(LH_PATH).size / 1024).toFixed(1);
  console.log("OK · existentes intactas:", beforeKeys.size, "· agregadas:", added, "· total:", Object.keys(result).length, "· " + sizeKB + "KB");
}
main();
