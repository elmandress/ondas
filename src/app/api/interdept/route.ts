/**
 * GET /api/interdept?dest=Punta+del+Este[&depto=MALDONADO]
 * Próximas salidas interdepartamentales DESDE Montevideo hacia un destino, según
 * el horario oficial del MTOP (datos programados, NO en vivo). F2.4.
 */
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

interface Salida { empresa: string; salida: string; llegada: string; dias: string }
let _data: Record<string, Salida[]> | null = null;
function getData(): Record<string, Salida[]> {
  if (_data) return _data;
  try {
    _data = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public", "interdept.json"), "utf-8"));
  } catch { _data = {}; }
  return _data!;
}

// "Lu,Ma,Mi,Ju,Vi,Sa,Do,Fe" → ¿corre hoy? (índice JS: 0=Do..6=Sa)
const DAY_CODES = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sa"];
function runsToday(dias: string, now: Date): boolean {
  const code = DAY_CODES[now.getDay()];
  return dias.split(",").map((d) => d.trim()).includes(code);
}

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

export async function GET(req: NextRequest) {
  const dest = req.nextUrl.searchParams.get("dest");
  if (!dest) return NextResponse.json({ error: "Falta dest" }, { status: 400 });

  const data = getData();
  const q = norm(dest);
  // Match por ciudad (clave = "CIUDAD|DEPTO"). Primero exacto, luego inclusión.
  let key = Object.keys(data).find((k) => norm(k.split("|")[0]) === q);
  if (!key) key = Object.keys(data).find((k) => norm(k.split("|")[0]).includes(q) || q.includes(norm(k.split("|")[0])));
  if (!key) return NextResponse.json({ dest, found: false, salidas: [] });

  const [ciudad, depto] = key.split("|");
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const all = data[key];

  // Próximas salidas de HOY (que corren hoy y aún no salieron), ordenadas.
  const hoy = all
    .filter((s) => runsToday(s.dias, now))
    .map((s) => {
      const [h, m] = (s.salida || "0:0").split(":").map(Number);
      return { ...s, min: h * 60 + (m || 0) };
    })
    .filter((s) => s.min >= nowMin - 5)
    .sort((a, b) => a.min - b.min)
    .slice(0, 8);

  // Empresas distintas que hacen este viaje (para "hay varias compañías").
  const empresas = [...new Set(all.filter((s) => runsToday(s.dias, now)).map((s) => s.empresa))].sort();

  return NextResponse.json({
    dest, found: true, ciudad, depto,
    totalDiarias: all.filter((s) => runsToday(s.dias, now)).length,
    empresas,
    // En Montevideo, los interdepartamentales salen de la Terminal Tres Cruces.
    terminal: "Terminal Tres Cruces (Bv. Artigas y Av. Italia, Montevideo)",
    salidas: hoy.map(({ empresa, salida, llegada, dias }) => ({ empresa, salida, llegada, dias })),
    fuente: "MTOP — horarios oficiales (programados)",
  });
}
