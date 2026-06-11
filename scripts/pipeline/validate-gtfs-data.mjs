/**
 * PG-3 (02-validate): valida la ESTRUCTURA e integridad de los datos pre-procesados
 * que la app consume en runtime. Corre en CI en cada push y localmente después de
 * cualquier regeneración manual del GTFS. Sin esto, un dato corrupto o truncado
 * entra silencioso y "las rutas no andan" recién se descubre en producción.
 *
 * Valida:
 *   - data/gtfs-v2.json   → índices del planner (gtfs-db.ts depende de esta estructura)
 *   - public/stops.json   → dataset de paradas (el cliente lo carga entero)
 *   - data/line-hours.json → bitsets de cobertura horaria por línea
 *   - Cruce: las paradas referenciadas por variantes existen en stops.json
 *
 * Umbrales: ~75-80% de los valores actuales (2026-06: 230 líneas, 1480 variantes,
 * 10393 paradas). Detectan truncamientos catastróficos sin romper por la variación
 * normal entre versiones del GTFS oficial.
 *
 * Uso: node scripts/pipeline/validate-gtfs-data.mjs   (exit 1 si falla algo)
 */
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const errors = [];
const warnings = [];

function fail(msg) { errors.push(msg); console.error(`  ✗ ${msg}`); }
function warn(msg) { warnings.push(msg); console.warn(`  ⚠ ${msg}`); }
function ok(msg) { console.log(`  ✓ ${msg}`); }

function loadJson(rel) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) { fail(`${rel} no existe`); return null; }
  try { return JSON.parse(fs.readFileSync(p, "utf-8")); }
  catch (e) { fail(`${rel} no es JSON válido: ${e.message}`); return null; }
}

// Uruguay (con margen): cualquier parada fuera de esto es un dato roto.
const LAT_MIN = -35.5, LAT_MAX = -30.0, LON_MIN = -59.0, LON_MAX = -52.9;

// ── 1. gtfs-v2.json ──────────────────────────────────────────────────────────
console.log("\n[1/4] data/gtfs-v2.json");
const gtfs = loadJson("data/gtfs-v2.json");
if (gtfs) {
  for (const key of ["variantsByLine", "stopsByVariant", "variantsByStop", "variantMeta"]) {
    if (!gtfs[key] || typeof gtfs[key] !== "object") fail(`falta índice "${key}" (gtfs-db.ts lo requiere)`);
  }
  if (errors.length === 0) {
    const nLines = Object.keys(gtfs.variantsByLine).length;
    const nVariants = Object.keys(gtfs.variantMeta).length;
    const nStops = Object.keys(gtfs.variantsByStop).length;
    if (nLines < 180) fail(`solo ${nLines} líneas (umbral 180) — ¿GTFS truncado?`);
    else ok(`${nLines} líneas`);
    if (nVariants < 1100) fail(`solo ${nVariants} variantes (umbral 1100)`);
    else ok(`${nVariants} variantes`);
    if (nStops < 8000) fail(`solo ${nStops} paradas con variantes (umbral 8000)`);
    else ok(`${nStops} paradas con variantes`);

    // Spot-check de estructura: cada variante con paradas ordenadas por sequence
    // y arrays [stopId, seq, arrSec]. Muestreo (validar 1480 enteras es innecesario).
    const variantIds = Object.keys(gtfs.stopsByVariant);
    const sample = variantIds.filter((_, i) => i % 50 === 0);
    let structBad = 0;
    for (const vid of sample) {
      const stops = gtfs.stopsByVariant[vid];
      if (!Array.isArray(stops) || stops.length === 0) { structBad++; continue; }
      let prevSeq = -1;
      for (const row of stops) {
        if (!Array.isArray(row) || row.length < 3 || typeof row[0] !== "string" || typeof row[1] !== "number") { structBad++; break; }
        if (row[1] <= prevSeq) { structBad++; break; } // sequence debe ser creciente
        prevSeq = row[1];
      }
      if (!gtfs.variantMeta[vid]) structBad++;
    }
    if (structBad > 0) fail(`${structBad}/${sample.length} variantes muestreadas con estructura inválida`);
    else ok(`estructura de stopsByVariant OK (muestra de ${sample.length})`);
  }
}

// ── 2. public/stops.json ─────────────────────────────────────────────────────
console.log("\n[2/4] public/stops.json");
const stops = loadJson("public/stops.json");
let stopIds = null;
if (stops) {
  if (!Array.isArray(stops)) fail("stops.json no es un array");
  else {
    if (stops.length < 8000) fail(`solo ${stops.length} paradas (umbral 8000)`);
    else ok(`${stops.length} paradas`);
    let badShape = 0, badCoord = 0;
    stopIds = new Set();
    for (const s of stops) {
      if (typeof s.stopId !== "string" || typeof s.stopName !== "string" || !Array.isArray(s.lines)) { badShape++; continue; }
      stopIds.add(s.stopId);
      if (!(s.stopLat >= LAT_MIN && s.stopLat <= LAT_MAX && s.stopLon >= LON_MIN && s.stopLon <= LON_MAX)) badCoord++;
    }
    if (badShape > 0) fail(`${badShape} paradas con campos faltantes (stopId/stopName/lines)`);
    else ok("campos requeridos presentes en todas");
    if (badCoord > 0) fail(`${badCoord} paradas con coordenadas fuera de Uruguay`);
    else ok("todas las coordenadas dentro de Uruguay");
    if (stopIds.size !== stops.length) warn(`${stops.length - stopIds.size} stopId duplicados`);
  }
}

// ── 3. data/line-hours.json ──────────────────────────────────────────────────
console.log("\n[3/4] data/line-hours.json");
const lineHours = loadJson("data/line-hours.json");
if (lineHours) {
  const keys = Object.keys(lineHours);
  if (keys.length < 150) fail(`solo ${keys.length} líneas con horarios (umbral 150)`);
  else ok(`${keys.length} líneas con cobertura horaria`);
  let badBitset = 0;
  for (const k of keys) {
    for (const tipo of ["1", "2", "3"]) {
      const b64 = lineHours[k][tipo];
      if (b64 === undefined || b64 === "") continue; // sin servicio ese tipo de día: válido
      // 96 bits = 12 bytes → 16 chars base64
      if (typeof b64 !== "string" || Buffer.from(b64, "base64").length !== 12) { badBitset++; }
    }
  }
  if (badBitset > 0) fail(`${badBitset} bitsets con largo inválido (deben ser 12 bytes / 96 bits)`);
  else ok("bitsets de 96 bits válidos");
}

// ── 4. Cruce gtfs-v2.json ↔ stops.json ───────────────────────────────────────
console.log("\n[4/4] cruce variantes ↔ paradas");
if (gtfs?.variantsByStop && stopIds) {
  const variantStopIds = Object.keys(gtfs.variantsByStop);
  const missing = variantStopIds.filter((id) => !stopIds.has(id));
  const pct = (missing.length / variantStopIds.length) * 100;
  // Tolerancia 5%: el GTFS puede referenciar paradas que el filtro de stops.json
  // descartó (sin nombre, etc.). Más que eso = los datasets se desincronizaron.
  if (pct > 5) fail(`${missing.length} paradas (${pct.toFixed(1)}%) referenciadas por variantes NO están en stops.json — datasets desincronizados (ej: ${missing.slice(0, 5).join(", ")})`);
  else if (missing.length > 0) ok(`${missing.length} paradas referenciadas fuera de stops.json (${pct.toFixed(1)}% ≤ 5% tolerado)`);
  else ok("todas las paradas de variantes existen en stops.json");
}

// ── Resultado ────────────────────────────────────────────────────────────────
console.log("");
if (errors.length > 0) {
  console.error(`VALIDACIÓN FALLÓ: ${errors.length} error(es), ${warnings.length} aviso(s).`);
  process.exit(1);
}
console.log(`Validación OK (${warnings.length} aviso(s)).`);
