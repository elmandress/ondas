/**
 * Ingesta del dataset OFICIAL ABIERTO del MTOP: horarios de ómnibus interdepartamentales
 * (catalogodatos.gub.uy — datos públicos del Estado, reuso libre). Es el ÚNICO espacio
 * donde nadie compite bien (Google: horarios pobres; Moovit: sin interdept) y trae lo que
 * hoy falta: AMBOS sentidos (interior→MVD) y entre-departamentos.
 *
 * ── POR QUÉ ESTE SCRIPT NO LO CORRE EL AGENTE ──
 * Los sitios .gub.uy usan la CA intermedia de AGESIC que Node no trae en su bundle →
 * el fetch falla con SELF_SIGNED_CERT_IN_CHAIN. La solución de build (igual que
 * process-routes.js con el shapefile del SIT) es relajar TLS SOLO para este script de
 * build (NUNCA en runtime). Eso requiere tu OK explícito:
 *
 *     NODE_TLS_REJECT_UNAUTHORIZED=0 node scripts/pipeline/ingest-mtop-interdept.mjs
 *
 * Alternativa sin tocar TLS: NODE_EXTRA_CA_CERTS=<ca-agesic.pem> (más prolijo si tenés
 * el certificado de AGESIC).
 *
 * ── QUÉ HACE ──
 * 1. CKAN package_show → lista los recursos del dataset.
 * 2. Descarga los CSV a data/mtop/ (cache local; no re-baja si ya están).
 * 3. Detecta el encabezado y reporta las columnas reales (origen/destino/empresa/hora/
 *    paradas) — el esquema del MTOP cambia entre recursos, así que la 1ª corrida es de
 *    DESCUBRIMIENTO: imprime columnas + 2 filas de muestra por recurso para afinar el
 *    transform final a public/interdept.json sin adivinar.
 *
 * Diseño honesto: NO inventa estructura. Si una columna esperada no está, lo dice.
 */
import fs from "fs";
import path from "path";

const DATASET_ID = "horarios-de-omnibus-en-lineas-interdepartamentales";
const CKAN = `https://catalogodatos.gub.uy/api/3/action/package_show?id=${DATASET_ID}`;
const OUT_DIR = path.join(process.cwd(), "data", "mtop");

function parseCsvLine(line) {
  const res = []; let cur = "", q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if ((ch === "," || ch === ";") && !q) { res.push(cur); cur = ""; }
    else cur += ch;
  }
  res.push(cur); return res;
}

const COL_HINTS = {
  origen: /^(origen|desde|localidad_?origen|ciudad_?origen|partida)/i,
  destino: /^(destino|hasta|localidad_?destino|ciudad_?destino|llegada)/i,
  empresa: /^(empresa|operador|raz[oó]n)/i,
  hora: /(hora|salida|frecuencia|horario)/i,
  paradas: /(parada|recorrido|intermedi|escala)/i,
  sentido: /(sentido|direcci[oó]n|ida|vuelta)/i,
};

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`[mtop] CKAN: ${CKAN}`);
  let pkg;
  try {
    const r = await fetch(CKAN, { signal: AbortSignal.timeout(20000), headers: { "User-Agent": "CuandoMVD/1.0 (transporte uruguay)" } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    pkg = (await r.json()).result;
  } catch (e) {
    console.error(`[mtop] no se pudo leer el catálogo: ${e.message} (${e.cause?.code || ""})`);
    console.error("[mtop] si es SELF_SIGNED_CERT_IN_CHAIN, correr con NODE_TLS_REJECT_UNAUTHORIZED=0 (ver header).");
    process.exit(1);
  }

  const resources = (pkg.resources || []).filter((r) => /csv/i.test(r.format || "") || /\.csv($|\?)/i.test(r.url || ""));
  console.log(`[mtop] ${resources.length} recurso(s) CSV de ${(pkg.resources || []).length} totales\n`);

  for (const res of resources) {
    const safe = (res.name || res.id || "rec").replace(/[^\w.-]+/g, "_").slice(0, 60);
    const dest = path.join(OUT_DIR, `${safe}.csv`);
    if (!fs.existsSync(dest)) {
      try {
        const r = await fetch(res.url, { signal: AbortSignal.timeout(30000), headers: { "User-Agent": "CuandoMVD/1.0" } });
        if (!r.ok) { console.log(`  ✗ ${safe}: HTTP ${r.status}`); continue; }
        fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
      } catch (e) { console.log(`  ✗ ${safe}: ${e.message}`); continue; }
    }
    // Descubrir esquema
    const txt = fs.readFileSync(dest, "utf8").replace(/^﻿/, "");
    const lines = txt.split(/\r?\n/).filter((l) => l.length);
    if (!lines.length) { console.log(`  ⚠ ${safe}: vacío`); continue; }
    const header = parseCsvLine(lines[0]);
    const mapped = {};
    for (const [role, re] of Object.entries(COL_HINTS)) {
      const idx = header.findIndex((h) => re.test(h.trim()));
      if (idx >= 0) mapped[role] = header[idx].trim();
    }
    console.log(`  ✓ ${safe} (${lines.length - 1} filas)`);
    console.log(`     columnas: ${header.join(" | ")}`);
    console.log(`     detectadas: ${Object.entries(mapped).map(([k, v]) => `${k}=«${v}»`).join("  ") || "(ninguna — revisar manualmente)"}`);
    console.log(`     muestra: ${parseCsvLine(lines[1] || "").slice(0, 6).join(" · ")}\n`);
  }

  console.log("[mtop] descubrimiento OK. Con las columnas reales arriba se finaliza el");
  console.log("[mtop] transform → public/interdept.json (salidas + llegadas + entre_deptos).");
}

main();
