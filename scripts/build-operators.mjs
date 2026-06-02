/**
 * Construye public/operators.json: mapea cada LÍNEA a su EMPRESA operadora
 * (nombre, sitio web, teléfono). Dos fuentes:
 *   1. GTFS metropolitano (tmp_nac/gtfs): agency real por línea suburbana (COPSA, UCOT…).
 *   2. Catálogo curado de empresas urbanas de MVD (CUTCSA/COETC/UCOT) + sus webs.
 *      Las líneas urbanas de MVD comparten "STM-MVD" en el GTFS (no distingue empresa);
 *      la empresa real por bus llega en vivo (companyName de la API). Acá damos el
 *      catálogo de contactos para que la UI pueda linkear web/teléfono.
 *
 * USO: node scripts/build-operators.mjs
 */
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const GTFS = path.join(ROOT, "tmp_nac", "gtfs");
const OUT = path.join(ROOT, "public", "operators.json");

function pc(l) { const o = []; let c = "", q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === "," && !q) { o.push(c); c = ""; } else c += ch; } o.push(c); return o; }
function readCsv(p) {
  const t = fs.readFileSync(p, "utf8").replace(/\r/g, "");
  const ls = t.split("\n").filter((x) => x.trim());
  const h = pc(ls[0]).map((x) => x.replace(/"/g, ""));
  return ls.slice(1).map((l) => { const c = pc(l); const o = {}; h.forEach((k, i) => (o[k] = (c[i] || "").replace(/^"|"$/g, ""))); return o; });
}

// 1. agency del GTFS metro
const agencies = {};
for (const a of readCsv(path.join(GTFS, "agency.txt"))) {
  agencies[a.agency_id] = { name: a.agency_name, url: a.agency_url };
}
// 2. línea metro -> empresa (agency más frecuente por línea)
const lineToAgency = {};
const counts = {};
for (const r of readCsv(path.join(GTFS, "routes.txt"))) {
  const sn = (r.route_short_name || "").trim();
  if (!sn) continue;
  counts[sn] = counts[sn] || {};
  counts[sn][r.agency_id] = (counts[sn][r.agency_id] || 0) + 1;
}
for (const [sn, byAg] of Object.entries(counts)) {
  const best = Object.entries(byAg).sort((a, b) => b[1] - a[1])[0][0];
  const ag = agencies[best];
  if (ag) lineToAgency[sn] = { empresa: ag.name, web: ag.url };
}

// 3. Catálogo curado de empresas de Montevideo (datos públicos verificados).
//    No mapeamos línea→empresa para MVD (el GTFS no lo da); este catálogo permite
//    a la UI mostrar contacto cuando la API live nos dice la empresa de un bus.
const mvdOperators = {
  CUTCSA: { empresa: "CUTCSA", web: "https://www.cutcsa.com.uy/" },
  COETC: { empresa: "COETC", web: "https://www.coetc.com/" },
  UCOT: { empresa: "UCOT", web: "https://www.ucot.net" },
  COME: { empresa: "COME", web: "http://www.come.com.uy" },
  CITA: { empresa: "CITA", web: "https://cita.com.uy" },
  COPSA: { empresa: "COPSA", web: "https://www.copsa.com.uy/es/" },
  CASANOVA: { empresa: "CASANOVA", web: "http://www.casanova.com.uy" },
  "TALA-PANDO-MONTEVIDEO": { empresa: "TPM (Tala-Pando-Montevideo)", web: "http://www.tpm.com.uy" },
  TPM: { empresa: "TPM (Tala-Pando-Montevideo)", web: "http://www.tpm.com.uy" },
};

const out = { byLine: lineToAgency, byCompany: mvdOperators };
fs.writeFileSync(OUT, JSON.stringify(out));
console.log(`[operators] ${Object.keys(lineToAgency).length} líneas metro mapeadas + ${Object.keys(mvdOperators).length} empresas en catálogo`);
console.log(`[operators] -> ${OUT}`);
