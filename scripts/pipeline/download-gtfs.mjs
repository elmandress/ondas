/**
 * PG-3 (01-download): descarga y extrae el GTFS estático oficial del STM.
 *
 * Flujo OAuth2 client_credentials (mismas credenciales que la app) → baja
 * google_transit.zip + version.txt → extrae a un directorio limpio.
 *
 * Uso:
 *   node scripts/pipeline/download-gtfs.mjs [outDir]
 *     default outDir: tmp_gtfs_latest
 *
 * Credenciales: MVD_API_CLIENT_ID / MVD_API_CLIENT_SECRET (env o .env.local).
 * Imprime la versión descargada — usarla para verificar contra check-gtfs-freshness.
 */
import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";

const ROOT = process.cwd();
const OUT_DIR = process.argv[2] || "tmp_gtfs_latest";
const TOKEN_URL = process.env.MVD_API_TOKEN_URL || "https://mvdapi-auth.montevideo.gub.uy/token";
const API_BASE = process.env.MVD_API_BASE || "https://api.montevideo.gub.uy/api/transportepublico";

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
if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("✗ Faltan MVD_API_CLIENT_ID / MVD_API_CLIENT_SECRET (env o .env.local)");
  process.exit(1);
}

async function getToken() {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`token HTTP ${res.status}`);
  const { access_token } = await res.json();
  if (!access_token) throw new Error("token vacío");
  return access_token;
}

const REQUIRED_FILES = ["agency.txt", "routes.txt", "trips.txt", "stop_times.txt", "stops.txt", "calendar.txt"];

async function main() {
  const token = await getToken();
  const auth = { Authorization: `Bearer ${token}` };

  const vRes = await fetch(`${API_BASE}/buses/gtfs/static/latest/version.txt`, {
    headers: auth, signal: AbortSignal.timeout(8000),
  });
  if (!vRes.ok) throw new Error(`version.txt HTTP ${vRes.status}`);
  const version = (await vRes.text()).trim();
  console.log(`[download] versión upstream: ${version}`);

  console.log("[download] bajando google_transit.zip…");
  const zRes = await fetch(`${API_BASE}/buses/gtfs/static/latest/google_transit.zip`, {
    headers: auth, signal: AbortSignal.timeout(120_000),
  });
  if (!zRes.ok) throw new Error(`zip HTTP ${zRes.status}`);
  const buf = Buffer.from(await zRes.arrayBuffer());
  console.log(`[download] ${(buf.length / 1024 / 1024).toFixed(1)} MB`);

  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  new AdmZip(buf).extractAllTo(OUT_DIR, true);

  const missing = REQUIRED_FILES.filter((f) => !fs.existsSync(path.join(OUT_DIR, f)));
  if (missing.length > 0) {
    console.error(`✗ El zip no trae archivos requeridos: ${missing.join(", ")}`);
    process.exit(1);
  }
  fs.writeFileSync(path.join(OUT_DIR, "VERSION"), version + "\n");
  console.log(`[download] extraído OK en ${OUT_DIR}/ (${fs.readdirSync(OUT_DIR).length} archivos) · versión ${version}`);
}

main().catch((e) => { console.error("✗", e.message); process.exit(1); });
