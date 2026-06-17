/**
 * Recolector de PARADAS del interior por crowdsource pasivo del GPS en vivo.
 *
 * El avl Busmatick reporta, por cada bus, su próxima parada (p1c código + p1n nombre)
 * pero NO sus coordenadas. Cuando un bus está casi detenido (vel baja) y a punto de
 * llegar a esa parada, su posición ≈ la posición de la parada. Acumulando MUCHAS
 * observaciones y promediando (mediana robusta) por código de parada, las coords
 * convergen a la parada real.
 *
 * Idempotente: acumula en data/interior-stops-raw.json (todas las observaciones) y
 * recalcula data/interior-stops.json (paradas con coords estimadas). Correr muchas
 * veces a lo largo de varios días para cubrir la red. NO es runtime: build-time.
 *
 * USO: node scripts/collect-interior-stops.mjs            (una pasada de todas las zonas)
 *      node scripts/collect-interior-stops.mjs maldonado 20 5   (zona, nMuestras, segIntervalo)
 */
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const RAW = path.join(ROOT, "data", "interior-stops-raw.json");
const OUT = path.join(ROOT, "data", "interior-stops.json");

const SOURCES = {
  maldonado: { url: "http://ip.codesa.com.uy/pub/avl.xml", fmt: "xml" },
  sancarlos: { url: "http://solantigua.ddns.net:2780/pub/avl.xml", fmt: "xml" },
  paysandu: { url: "https://bus.copay.com.uy:10443/pub/avl.xml", fmt: "xml" },
  rocha: { url: "https://sig.rocha.gub.uy/leaflet/json/avl.geojson", fmt: "geojson" },
};

const MAX_SPEED = 8;     // km/h: bus "en la parada o llegando"
const CLUSTER_M = 60;    // observaciones a >60m de la mediana se descartan (ruido)

function tag(b, t) { const m = b.match(new RegExp(`<${t}>([^<]*)</${t}>`)); return m ? m[1] : ""; }

async function fetchObs(zona) {
  const s = SOURCES[zona];
  const obs = [];
  const edges = []; // { zona, line, sen, from, to } — aristas del recorrido (p1c→p2c)
  try {
    const r = await fetch(`${s.url}?nc=${Date.now()}`);
    const buf = Buffer.from(await r.arrayBuffer());
    if (s.fmt === "geojson") {
      const j = JSON.parse(buf.toString("utf-8"));
      for (const f of j.features || []) {
        const p = f.properties || {}, c = f.geometry?.coordinates;
        if (c && +p.vel <= MAX_SPEED && p.p1c) obs.push({ zona, code: String(p.p1c), name: p.p1n || "", lat: c[1], lon: c[0], line: String(p.lin || "") });
        if (p.lin && p.p1c && p.p2c) edges.push({ zona, line: String(p.lin), sen: String(p.sen ?? ""), from: String(p.p1c), to: String(p.p2c) });
      }
    } else {
      const xml = buf.toString("latin1");
      for (const m of xml.match(/<marker>[\s\S]*?<\/marker>/g) || []) {
        const vel = +tag(m, "vel"), lat = +tag(m, "lat"), lon = +tag(m, "lon"), code = tag(m, "p1c"), name = tag(m, "p1n"), lin = tag(m, "lin");
        if (vel <= MAX_SPEED && code && isFinite(lat) && isFinite(lon)) obs.push({ zona, code, name, lat, lon, line: lin });
        const sen = tag(m, "sen"), p2c = tag(m, "p2c");
        if (lin && code && p2c) edges.push({ zona, line: lin, sen, from: code, to: p2c });
      }
    }
  } catch { /* fuente caída */ }
  return { obs, edges };
}

function median(arr) { const s = [...arr].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; }
function haversine(a, b) { const R = 6371000, dLat = (b[0] - a[0]) * Math.PI / 180, dLon = (b[1] - a[1]) * Math.PI / 180; const x = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * Math.PI / 180) * Math.cos(b[0] * Math.PI / 180) * Math.sin(dLon / 2) ** 2; return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)); }

function recompute(raw) {
  // raw: { "zona|code": { name, obs: [[lat,lon],...] } }
  const out = {};
  for (const [key, rec] of Object.entries(raw)) {
    if (rec.obs.length < 3) continue; // mínimo 3 observaciones para confiar
    const mLat = median(rec.obs.map((o) => o[0]));
    const mLon = median(rec.obs.map((o) => o[1]));
    // descartar outliers y promediar los que quedan cerca de la mediana
    const inliers = rec.obs.filter((o) => haversine([mLat, mLon], o) <= CLUSTER_M);
    if (inliers.length < 3) continue;
    const lat = inliers.reduce((s, o) => s + o[0], 0) / inliers.length;
    const lon = inliers.reduce((s, o) => s + o[1], 0) / inliers.length;
    const [zona, code] = key.split("|");
    const lines = (rec.lines || []).slice().sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
    out[key] = { zona, code, name: rec.name, lat: +lat.toFixed(5), lon: +lon.toFixed(5), samples: rec.obs.length, lines };
  }
  return out;
}

async function main() {
  const zonaArg = process.argv[2];
  const rounds = parseInt(process.argv[3] || "1", 10);
  const everyS = parseInt(process.argv[4] || "0", 10);
  const zonas = zonaArg ? [zonaArg] : Object.keys(SOURCES);

  const raw = fs.existsSync(RAW) ? JSON.parse(fs.readFileSync(RAW, "utf-8")) : {};
  // Aristas del recorrido por línea: { "zona|line|sen": { "from>to": count } }
  const EDGES = path.join(ROOT, "data", "interior-edges.json");
  const edgesRaw = fs.existsSync(EDGES) ? JSON.parse(fs.readFileSync(EDGES, "utf-8")) : {};
  for (let r = 0; r < rounds; r++) {
    for (const z of zonas) {
      const { obs, edges } = await fetchObs(z);
      for (const o of obs) {
        const key = `${o.zona}|${o.code}`;
        if (!raw[key]) raw[key] = { name: o.name, obs: [], lines: [] };
        raw[key].obs.push([o.lat, o.lon]);
        if (raw[key].obs.length > 200) raw[key].obs.shift();
        if (o.line && !(raw[key].lines || (raw[key].lines = [])).includes(o.line)) raw[key].lines.push(o.line);
      }
      for (const e of edges) {
        const lk = `${e.zona}|${e.line}|${e.sen}`;
        const ek = `${e.from}>${e.to}`;
        (edgesRaw[lk] ||= {})[ek] = (edgesRaw[lk][ek] || 0) + 1;
      }
      process.stdout.write(`  ${z}: +${obs.length} obs, +${edges.length} aristas\n`);
    }
    if (everyS && r < rounds - 1) await new Promise((res) => setTimeout(res, everyS * 1000));
  }

  fs.writeFileSync(RAW, JSON.stringify(raw));
  fs.writeFileSync(EDGES, JSON.stringify(edgesRaw));
  // El runtime (useInteriorArrivals) navega el grafo client-side → necesita la copia
  // servida en public/. Escribimos ambas acá para que no driften entre corridas.
  fs.writeFileSync(path.join(ROOT, "public", "interior-edges.json"), JSON.stringify(edgesRaw));
  const stops = recompute(raw);
  fs.writeFileSync(OUT, JSON.stringify(stops));
  fs.writeFileSync(path.join(ROOT, "public", "interior-stops.json"), JSON.stringify(stops));
  console.log(`\n[stops] raw: ${Object.keys(raw).length} códigos · confiables (≥3 obs, cluster): ${Object.keys(stops).length}`);
  console.log(`[edges] ${Object.keys(edgesRaw).length} líneas-sentido con aristas de recorrido`);
}
main();
