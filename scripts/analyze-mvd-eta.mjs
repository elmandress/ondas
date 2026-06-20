// Análisis del poller de ETA de MVD: error real del motor vs la llegada observada.
// Por (parada, coche): secuencia de (t, eta). Cuando el coche DESAPARECE con eta chico
// (≤4 min, = llegó, no GPS-drop lejano), la llegada real ≈ punto medio entre el último
// visto y el primero ausente. error = eta_mostrado − (llegada_real − t_obs)/60.
import fs from "fs";
const ARRIVED_MAX_ETA = 4; // último eta para considerar "llegó" (no drop lejano)

const lines = fs.readFileSync("d:/tmp/eta-poll.jsonl", "utf-8").trim().split("\n").map((l) => JSON.parse(l));
// agrupar por parada → rounds ordenados
const byStop = {};
for (const r of lines) {
  if (!r.buses || r.buses.err) continue;
  (byStop[r.stopId] ||= { tipo: r.tipo, rounds: [] }).rounds.push({ t: r.t, buses: r.buses });
}

const errors = []; // {stopId, tipo, etaShown, real, err}
for (const [stopId, { tipo, rounds }] of Object.entries(byStop)) {
  rounds.sort((a, b) => a.t - b.t);
  // trayectoria por coche
  const seen = {}; // v → [{t, eta}]
  for (const rd of rounds) for (const b of rd.buses) {
    if (b.v == null || !b.rt) continue;
    (seen[b.v] ||= []).push({ t: rd.t, eta: b.eta });
  }
  const roundTimes = rounds.map((r) => r.t);
  for (const [v, seq] of Object.entries(seen)) {
    const last = seq[seq.length - 1];
    if (last.eta > ARRIVED_MAX_ETA) continue; // no claramente "llegó"
    // primer round AUSENTE después del último visto
    const idxLast = roundTimes.indexOf(last.t);
    const tNext = roundTimes[idxLast + 1];
    if (tNext == null) continue; // se cortó la ventana, no sabemos si llegó
    const arrival = (last.t + tNext) / 2;
    for (const obs of seq) {
      const real = (arrival - obs.t) / 60000; // ms → min reales hasta llegar
      if (real < -1) continue; // ruido
      errors.push({ stopId, tipo, etaShown: obs.eta, real: +real.toFixed(1), err: +(obs.eta - real).toFixed(1) });
    }
  }
}

if (!errors.length) { console.log("sin llegadas detectables (ventana corta / sampling grueso)"); process.exit(0); }
const errs = errors.map((e) => e.err);
const mean = errs.reduce((s, e) => s + e, 0) / errs.length;
const abs = errs.map((e) => Math.abs(e)).sort((a, b) => a - b);
const mae = abs.reduce((s, e) => s + e, 0) / abs.length;
const medAbs = abs[Math.floor(abs.length / 2)];
console.log("=== ERROR DEL ETA DE MVD (n=" + errors.length + " observaciones, " + Object.keys(byStop).length + " paradas) ===");
console.log("error medio (signo):", mean.toFixed(2), "min  (+ = sobreestima, − = subestima)");
console.log("error absoluto medio (MAE):", mae.toFixed(2), "min | mediana abs:", medAbs, "min");
console.log("rango:", Math.min(...errs).toFixed(1), "a", Math.max(...errs).toFixed(1), "min");
// por tipo de parada
const byTipo = {};
for (const e of errors) (byTipo[e.tipo] ||= []).push(e.err);
console.log("--- por tipo de parada (error medio) ---");
for (const [t, es] of Object.entries(byTipo)) console.log("  " + t + ": " + (es.reduce((s, x) => s + x, 0) / es.length).toFixed(2) + " min (n=" + es.length + ")");
