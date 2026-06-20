// Research-only (Frente 2a): mide la precisión real del ETA del motor de MVD.
// Pollea /api/stm/arrivals de varias paradas cada 30s y registra, por bus, el ETA mostrado
// en cada poll + el timestamp. Cuando un bus desaparece de la lista (con ETA chico = llegó),
// el análisis compara el ETA que se mostró contra el tiempo real hasta la desaparición.
import fs from "fs";

const BASE = "http://localhost:3100";
const STOPS = [
  { id: "3178", tipo: "avenida (18 de Julio)" },
  { id: "2121", tipo: "avenida (Av Italia)" },
  { id: "4843", tipo: "terminal (Cerro)" },
  { id: "2902", tipo: "residencial (Malvin Norte)" },
];
const OUT = "d:/tmp/eta-poll.jsonl";
const INTERVAL_MS = 30_000;
const DURATION_MS = 50 * 60 * 1000; // 50 min

async function pollStop(stopId) {
  try {
    const r = await fetch(`${BASE}/api/stm/arrivals?stopId=${stopId}`, { signal: AbortSignal.timeout(8000) });
    const d = await r.json();
    const arr = (d.arrivals || d.buses || []);
    return arr.map((a) => ({ v: a.vehicleId ?? null, line: a.lineName ?? a.lineId, eta: a.eta, rt: a.realtime !== false }));
  } catch (e) {
    return { err: e.message };
  }
}

(async () => {
  fs.writeFileSync(OUT, "");
  const start = Date.now();
  let round = 0;
  while (Date.now() - start < DURATION_MS) {
    const t = Date.now();
    for (const s of STOPS) {
      const buses = await pollStop(s.id);
      fs.appendFileSync(OUT, JSON.stringify({ t, stopId: s.id, tipo: s.tipo, buses }) + "\n");
    }
    round++;
    console.log(`[${round}] ${new Date(t).toLocaleTimeString()} — polleadas ${STOPS.length} paradas`);
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }
  console.log("poller MVD completo →", OUT);
})();
