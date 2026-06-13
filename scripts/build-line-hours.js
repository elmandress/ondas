/**
 * Pre-computa cobertura horaria operativa de cada línea de bus por tipo_dia.
 *
 * Lee data/schedule.db (84MB, no se sube a serverless) y produce
 * data/line-hours.json (~10KB, bundleable en Netlify/Vercel).
 *
 * Formato salida (compacto):
 *   {
 *     "495": { "1": "AAA...", "2": "...", "3": "..." },   ← base64 de bitset de 96 bits
 *     ...
 *   }
 *   - Clave: short_name de la línea (ej "495", "183", "CA1")
 *   - tipo_dia: 1=hábil, 2=sábado, 3=domingo
 *   - Valor: 96 bits = 24h * 4 cuartos. Bit N=1 → la línea pasa en el cuarto
 *     de hora [N*15, N*15+14] minutos del día. Bit 0 = 00:00-00:14.
 *   - Si una línea no opera en ningún cuarto de un tipo_dia → bits vacíos (string vacío).
 *   - El campo "hora" del schedule es minutos desde inicio del día y puede
 *     exceder 1440 (servicios que cruzan medianoche). Normalizamos con mod 1440.
 *
 * Uso: node scripts/build-line-hours.js
 */
const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");

const SCHEDULE_PATH = path.join(__dirname, "..", "data", "schedule.db");
const MAP_PATH = path.join(__dirname, "..", "data", "variant_to_line.json");
const OUT_PATH = path.join(__dirname, "..", "data", "line-hours.json");

const QUARTERS = 96; // 24*4 cuartos de hora

function bitsetToBase64(bits) {
  // bits es Uint8Array de 12 bytes (96 bits)
  return Buffer.from(bits).toString("base64");
}

function main() {
  if (!fs.existsSync(SCHEDULE_PATH)) {
    console.error("schedule.db no existe en", SCHEDULE_PATH);
    process.exit(1);
  }
  if (!fs.existsSync(MAP_PATH)) {
    console.error("variant_to_line.json no existe en", MAP_PATH);
    process.exit(1);
  }

  const db = new Database(SCHEDULE_PATH, { readonly: true });
  const variantToLine = JSON.parse(fs.readFileSync(MAP_PATH, "utf-8"));

  const lineToVars = {};
  for (const [v, l] of Object.entries(variantToLine)) {
    if (!lineToVars[l]) lineToVars[l] = [];
    lineToVars[l].push(v);
  }

  const result = {};
  const lines = Object.keys(lineToVars).sort();
  console.log("Procesando", lines.length, "líneas...");

  for (const line of lines) {
    const vars = lineToVars[line];
    const placeholders = vars.map(() => "?").join(",");
    const byTipo = {};
    for (const tipo of [1, 2, 3]) {
      const bits = new Uint8Array(12);
      const rows = db
        .prepare(
          `SELECT DISTINCT hora FROM schedules WHERE cod_variante IN (${placeholders}) AND tipo_dia = ?`
        )
        .all(...vars, tipo);
      for (const r of rows) {
        // ⚠ schedule.db urbano guarda `hora` como HHMM (607 = 6:07), NO como minutos
        // (auditado R62). Sin convertir, 13:20 (1320) caía en el cuarto de las 22:00 →
        // ventanas de servicio CORRUPTAS en las landings /linea y el filtro horario del
        // ruteo. (metro-schedule.db SÍ son minutos: lo maneja merge-metro-hours.js.)
        const minOfDay = Math.floor(r.hora / 100) * 60 + (r.hora % 100);
        const q = Math.floor(minOfDay / 15); // 0..95
        bits[Math.floor(q / 8)] |= 1 << (q % 8);
      }
      if (rows.length) byTipo[tipo] = bitsetToBase64(bits);
    }
    if (byTipo[1] || byTipo[2] || byTipo[3]) {
      result[line] = byTipo;
    }
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify(result));
  const sizeKB = (fs.statSync(OUT_PATH).size / 1024).toFixed(1);
  console.log("✔ Escrito", OUT_PATH, `(${sizeKB} KB, ${Object.keys(result).length} líneas)`);

  // Sample con interpretación
  function decodeBitset(b64) {
    const bytes = Buffer.from(b64, "base64");
    const out = [];
    for (let q = 0; q < QUARTERS; q++) {
      if (bytes[Math.floor(q / 8)] & (1 << (q % 8))) out.push(q);
    }
    return out;
  }
  function quartersToRanges(qs) {
    if (!qs.length) return "—";
    const ranges = [];
    let start = qs[0], prev = qs[0];
    for (let i = 1; i < qs.length; i++) {
      if (qs[i] === prev + 1) { prev = qs[i]; continue; }
      ranges.push([start, prev]);
      start = qs[i]; prev = qs[i];
    }
    ranges.push([start, prev]);
    return ranges.map(([a, b]) => {
      const fmt = (q) => `${String(Math.floor(q / 4)).padStart(2, "0")}:${String((q % 4) * 15).padStart(2, "0")}`;
      return `${fmt(a)}-${fmt(b + 1)}`;
    }).join(", ");
  }

  console.log("\nMuestras:");
  for (const sample of ["495", "182", "183", "300", "199", "CA1", "405"]) {
    const r = result[sample];
    if (!r) { console.log(" ", sample, "NO DATA"); continue; }
    for (const tipo of [1, 2, 3]) {
      const tipoName = tipo === 1 ? "hábil" : tipo === 2 ? "sab" : "dom";
      const b64 = r[tipo];
      const qs = b64 ? decodeBitset(b64) : [];
      console.log(` ${sample} ${tipoName}:`, quartersToRanges(qs));
    }
  }
}

main();
