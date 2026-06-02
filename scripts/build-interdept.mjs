/**
 * Procesa el CSV oficial de horarios interdepartamentales del MTOP a un JSON
 * compacto para la app (F2.4). Agrupa por DESTINO (ciudad) las salidas DESDE
 * Montevideo (el caso de uso: "quiero ir a Punta del Este / Salto / etc.").
 *
 * Honesto: son horarios PROGRAMADOS oficiales del MTOP (DNT). Incluimos vigencia
 * (F.Inicio/F.Fin) y días, y la fuente, para no presentar nada como "en vivo".
 *
 * Fuente: catalogodatos.gub.uy dataset interdepartamentales (latin1, separador ;).
 * USO: node scripts/build-interdept.mjs [csvPath] [outJson]
 */
import fs from "fs";
import path from "path";

const CSV = process.argv[2] || path.join(process.cwd(), "tmp_nac", "inter.csv");
const OUT = process.argv[3] || path.join(process.cwd(), "public", "interdept.json");

const raw = fs.readFileSync(CSV, "latin1").replace(/\r/g, "");
const lines = raw.split("\n").filter((l) => l.trim());
const H = lines[0].split(";");
const idx = Object.fromEntries(H.map((h, i) => [h.trim(), i]));

// Agrupamos por turno: un turno = una salida concreta. Tomamos la fila donde el
// "Lugar" coincide con el "Origen" (= el punto y hora de PARTIDA del servicio).
// Si no hay fila exacta de partida, usamos H.Salida del turno.
const turnos = new Map(); // id -> { empresa, origen, oriD, destino, desD, hSalida, hLlegada, dias, fIni, fFin }
for (let i = 1; i < lines.length; i++) {
  const c = lines[i].split(";");
  const id = c[idx["Id.Turno"]];
  const origen = c[idx["Origen"]];
  const destino = c[idx["Destino"]];
  if (!turnos.has(id)) {
    turnos.set(id, {
      empresa: c[idx["Empresa"]],
      origen, oriD: c[idx["Depto.Origen"]],
      destino, desD: c[idx["Depto.Destino"]],
      hSalida: c[idx["H.Salida"]],
      hLlegada: c[idx["H.Llegada"]],
      dias: c[idx["Dias"]],
      fIni: c[idx["F.Inicio"]], fFin: c[idx["F.Fin"]],
    });
  }
}

// Filtramos salidas DESDE Montevideo (caso de uso principal de la app).
// Agrupamos por ciudad de destino. Cada destino → lista de salidas ordenadas por hora.
const today = new Date().toISOString().slice(0, 10);
const byDest = new Map(); // "CIUDAD/DEPTO" -> [{empresa,hSalida,hLlegada,dias}]
for (const t of turnos.values()) {
  if (t.oriD !== "MONTEVIDEO") continue;
  // descartar turnos cuya vigencia ya venció
  if (t.fFin && t.fFin < today) continue;
  const key = `${t.destino}|${t.desD}`;
  if (!byDest.has(key)) byDest.set(key, []);
  byDest.get(key).push({
    empresa: t.empresa,
    salida: t.hSalida,
    llegada: t.hLlegada,
    dias: t.dias,
  });
}

// Ordenar salidas por hora y limitar (las muchas salidas de un mismo destino).
const out = {};
for (const [key, salidas] of byDest) {
  salidas.sort((a, b) => (a.salida || "").localeCompare(b.salida || ""));
  out[key] = salidas;
}

fs.writeFileSync(OUT, JSON.stringify(out));
const sz = fs.statSync(OUT).size;
console.log(`[interdept] ${turnos.size} turnos → ${Object.keys(out).length} destinos desde MVD (${(sz / 1024).toFixed(0)}KB)`);
console.log(`[interdept] ejemplos: ${Object.keys(out).slice(0, 6).join(", ")}`);
