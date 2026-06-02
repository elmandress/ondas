/**
 * Geocodifica (una vez, build-time) las ciudades destino del interdepartamental a
 * coordenadas reales → public/interior-cities.json. Sirve para que el buscador
 * reconozca "Punta del Este", "Salto", etc. como CIUDADES DEL INTERIOR (fuera del
 * bbox de Montevideo) y no como una calle homónima de MVD.
 *
 * Usa Nominatim a nivel país (sin bounded a MVD). Respeta el rate-limit (1 req/s).
 * USO: node scripts/build-interior-cities.mjs
 */
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const INTERDEPT = path.join(ROOT, "public", "interdept.json");
const OUT = path.join(ROOT, "public", "interior-cities.json");

// Normaliza "PUNTA DEL ESTE(R8)" → "Punta del Este" (saca sufijos entre paréntesis).
function cityBase(raw) {
  return raw.replace(/\(.*?\)/g, "").trim();
}
function titleCase(s) {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

const data = JSON.parse(fs.readFileSync(INTERDEPT, "utf8"));
// ciudad base -> depto (tomamos el primero visto)
const cities = new Map();
for (const key of Object.keys(data)) {
  const [ciudad, depto] = key.split("|");
  const base = cityBase(ciudad);
  if (!base || base.length < 3) continue;
  // saltar destinos extranjeros (no los ruteamos): Buenos Aires, Asunción, etc.
  if (["BUENOS AIRES", "ASUNCION DEL PARAGUAY", "FLORIANOPOLIS", "PORTO ALEGRE", "CORDOBA"].includes(base)) continue;
  if (!cities.has(base)) cities.set(base, depto);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = {};
let ok = 0, fail = 0;
for (const [base, depto] of cities) {
  const q = `${titleCase(base)}, ${titleCase(depto)}, Uruguay`;
  const params = new URLSearchParams({
    format: "json", q, countrycodes: "uy", limit: "1", "accept-language": "es",
  });
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { "User-Agent": "OndasMVD/1.0 (transporte-montevideo@ondas.uy)" },
    });
    const arr = res.ok ? await res.json() : [];
    if (arr[0]) {
      out[base] = {
        name: titleCase(base),
        depto: titleCase(depto),
        lat: parseFloat(arr[0].lat),
        lon: parseFloat(arr[0].lon),
      };
      ok++;
      console.log(`  ✓ ${q} → ${arr[0].lat},${arr[0].lon}`);
    } else { fail++; console.log(`  ✗ ${q} (sin resultado)`); }
  } catch (e) {
    fail++; console.log(`  ✗ ${q} (${e.message})`);
  }
  await sleep(1100); // rate-limit Nominatim
}

fs.writeFileSync(OUT, JSON.stringify(out));
console.log(`[interior-cities] ${ok} ciudades geocodificadas, ${fail} fallidas → ${OUT}`);
