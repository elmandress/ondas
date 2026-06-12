/**
 * PG-3 (freshness): ¿el GTFS oficial publicó una versión más nueva que la nuestra?
 *
 * El STM publica la versión vigente en /buses/gtfs/static/latest/version.txt
 * (string corta tipo "20260525"). Nosotros registramos en data/gtfs-version.json
 * qué versión usamos para generar los datos pre-procesados. Si difieren, los datos
 * envejecieron: hay que regenerar (proceso manual documentado abajo) — el workflow
 * semanal abre un issue para que no pase en silencio.
 *
 * Uso:
 *   node scripts/pipeline/check-gtfs-freshness.mjs          → compara y reporta
 *   node scripts/pipeline/check-gtfs-freshness.mjs --save   → registra la versión
 *     upstream actual como la nuestra (correr DESPUÉS de regenerar los datos)
 *
 * Credenciales: MVD_API_CLIENT_ID / MVD_API_CLIENT_SECRET (env o .env.local).
 * Sin credenciales → exit 0 con aviso (no rompe CI de forks).
 *
 * Exit codes: 0 = al día (o sin credenciales) · 3 = desactualizado · 1 = error.
 *
 * Regeneración manual (hasta que exista el pipeline completo):
 *   1. Descargar el ZIP GTFS oficial (mvd-api downloadGtfsZip) y extraerlo
 *   2. node scripts/build-gtfs-db.mjs <gtfsDir> data/gtfs-v2.db
 *   3. node scripts/export-gtfs-json.mjs
 *   4. node scripts/build-stops-json.mjs <gtfsDir> public/stops.json
 *   5. node scripts/merge-metro-gtfs.mjs  (si cambió el GTFS metropolitano)
 *   6. node scripts/build-stop-dirs.mjs   (pistas de sentido para Buscar — usa gtfs-v2.json+stops.json)
 *   7. npm run routes:update              (shapes SIT: routes.json + line-shapes.json + validación)
 *   8. node scripts/pipeline/validate-gtfs-data.mjs
 *   9. node scripts/pipeline/check-gtfs-freshness.mjs --save
 */
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const VERSION_FILE = path.join(ROOT, "data", "gtfs-version.json");
const TOKEN_URL = process.env.MVD_API_TOKEN_URL || "https://mvdapi-auth.montevideo.gub.uy/token";
const API_BASE = process.env.MVD_API_BASE || "https://api.montevideo.gub.uy/api/transportepublico";

// .env.local para corridas locales (sin dependencia de dotenv). Solo las vars
// MVD_API_* — no importar otras (ej. NODE_TLS_REJECT_UNAUTHORIZED) como efecto colateral.
function loadEnvLocal() {
  const p = path.join(ROOT, ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^(MVD_API_[A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnvLocal();

const CLIENT_ID = process.env.MVD_API_CLIENT_ID;
const CLIENT_SECRET = process.env.MVD_API_CLIENT_SECRET;

function ghOutput(key, value) {
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
  }
}

async function getUpstreamVersion() {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  });
  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(8000),
  });
  if (!tokenRes.ok) throw new Error(`token HTTP ${tokenRes.status}`);
  const { access_token } = await tokenRes.json();
  if (!access_token) throw new Error("token vacío");

  const res = await fetch(`${API_BASE}/buses/gtfs/static/latest/version.txt`, {
    headers: { Authorization: `Bearer ${access_token}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`version.txt HTTP ${res.status}`);
  const v = (await res.text()).trim();
  if (!v || v.length > 40) throw new Error(`versión upstream sospechosa: "${v.slice(0, 60)}"`);
  return v;
}

function readLocalVersion() {
  if (!fs.existsSync(VERSION_FILE)) return null;
  try { return JSON.parse(fs.readFileSync(VERSION_FILE, "utf-8")); }
  catch { return null; }
}

async function main() {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.warn("⚠ Sin credenciales MVD_API_CLIENT_ID/SECRET — check de frescura omitido.");
    ghOutput("stale", "false");
    process.exit(0);
  }

  let upstream;
  try {
    upstream = await getUpstreamVersion();
  } catch (e) {
    console.error(`✗ No se pudo consultar la versión upstream: ${e.message}`);
    ghOutput("stale", "false");
    process.exit(1);
  }

  const local = readLocalVersion();

  if (process.argv.includes("--save")) {
    fs.writeFileSync(
      VERSION_FILE,
      JSON.stringify({ version: upstream, recordedAt: new Date().toISOString().slice(0, 10) }, null, 2) + "\n",
    );
    console.log(`✓ Registrada versión GTFS "${upstream}" en data/gtfs-version.json`);
    process.exit(0);
  }

  console.log(`Upstream STM : ${upstream}`);
  console.log(`Local        : ${local?.version ?? "(sin registrar)"}${local?.recordedAt ? ` (registrada ${local.recordedAt})` : ""}`);
  ghOutput("upstream", upstream);
  ghOutput("local", local?.version ?? "unknown");

  if (!local?.version || local.version !== upstream) {
    console.log("\n✗ DESACTUALIZADO: el STM publicó un GTFS más nuevo que nuestros datos.");
    console.log("  Regenerar (ver pasos en el header de este script) y correr con --save.");
    ghOutput("stale", "true");
    process.exit(3);
  }

  console.log("\n✓ Al día.");
  ghOutput("stale", "false");
  process.exit(0);
}

main();
