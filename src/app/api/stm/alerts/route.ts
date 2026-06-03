/**
 * GET /api/stm/alerts
 * Avisos / desvíos OFICIALES del transporte de Montevideo.
 *
 * Fuente REAL descubierta del JS de la app oficial "Cómo Ir":
 *   https://api.montevideo.gub.uy/notificacion/mensajes  → {count, messages:[...]}
 * Es el mismo feed que muestra la IM en su app. Sin auth, JSON limpio. Cuando la IM
 * publica un desvío/aviso aparece acá; si no hay, count:0. Proxeamos server-side para
 * evitar CORS y normalizamos. Honesto: si la fuente cae, devolvemos lista vacía.
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SOURCE = "https://api.montevideo.gub.uy/notificacion/mensajes";

interface RawMessage {
  id?: number | string;
  titulo?: string;
  title?: string;
  mensaje?: string;
  texto?: string;
  cuerpo?: string;
  fecha?: string;
  date?: string;
  url?: string;
  link?: string;
  [k: string]: unknown;
}

export interface ServiceAlert {
  id: string;
  title: string;
  body: string;
  date?: string;
  url?: string;
}

export async function GET() {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch(SOURCE, {
      signal: ctrl.signal,
      headers: { "User-Agent": "Cuando/1.0", Accept: "application/json" },
    });
    clearTimeout(t);
    if (!r.ok) return NextResponse.json({ alerts: [], count: 0, ok: false });

    const data = (await r.json()) as { count?: number; messages?: RawMessage[] };
    const raw = Array.isArray(data.messages) ? data.messages : [];
    const alerts: ServiceAlert[] = raw.map((m, i) => ({
      id: String(m.id ?? i),
      title: (m.titulo || m.title || "Aviso del transporte").toString().trim(),
      body: (m.mensaje || m.texto || m.cuerpo || "").toString().trim(),
      date: (m.fecha || m.date || undefined) as string | undefined,
      url: (m.url || m.link || undefined) as string | undefined,
    }));
    return NextResponse.json({ alerts, count: alerts.length, ok: true });
  } catch {
    // Fuente caída / timeout → degradar sin romper.
    return NextResponse.json({ alerts: [], count: 0, ok: false });
  }
}
