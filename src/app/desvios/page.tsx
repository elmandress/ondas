import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic"; // refleja avisos en vivo
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Desvíos y avisos del transporte",
  description: "Cortes, obras y desvíos que afectan al transporte de Montevideo, en un solo lugar. Avisos oficiales en lenguaje claro.",
  alternates: { canonical: "/desvios" },
  openGraph: { title: "Desvíos y avisos del transporte · Cuándo", description: "Cortes, obras y desvíos del transporte de Montevideo, claros y al día.", type: "article" },
};

interface Alert { id: string; title: string; body: string; date?: string; url?: string }

async function getAlerts(): Promise<Alert[]> {
  try {
    const r = await fetch("https://api.montevideo.gub.uy/notificacion/mensajes", {
      headers: { "User-Agent": "Cuando/1.0", Accept: "application/json" },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return [];
    const d = (await r.json()) as { messages?: Array<Record<string, unknown>> };
    return (d.messages ?? []).map((m, i) => ({
      id: String(m.id ?? i),
      title: String(m.titulo || m.title || "Aviso del transporte"),
      body: String(m.mensaje || m.texto || m.cuerpo || ""),
      date: (m.fecha || m.date) as string | undefined,
      url: (m.url || m.link) as string | undefined,
    }));
  } catch {
    return [];
  }
}

export default async function DesviosPage() {
  const alerts = await getAlerts();
  return (
    <main style={{ position: "fixed", inset: 0, overflowY: "auto", background: "#070b14", color: "#eef0f5", fontFamily: "var(--ff)", padding: "calc(env(safe-area-inset-top) + 32px) 22px calc(40px + env(safe-area-inset-bottom))" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#9aa3b5", font: "600 13px/1 var(--ff)", marginBottom: 28 }}>← Cuándo</Link>
        <h1 style={{ font: "800 28px/1.1 var(--ff)", letterSpacing: "-0.02em", marginBottom: 8 }}>Desvíos y avisos</h1>
        <p style={{ font: "400 15px/1.5 var(--ff)", color: "#9aa3b5", marginBottom: 28 }}>
          Cortes, obras y desvíos que afectan al transporte de Montevideo. Fuente oficial de la Intendencia.
        </p>

        {alerts.length === 0 ? (
          <div style={{ padding: "28px 18px", borderRadius: 16, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", textAlign: "center" }}>
            <p style={{ font: "700 17px/1.3 var(--ff)" }}>Todo normal por ahora 🚌</p>
            <p style={{ font: "400 14px/1.5 var(--ff)", color: "#9aa3b5", marginTop: 6 }}>No hay desvíos ni avisos cargados en este momento.</p>
          </div>
        ) : (
          <ul style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {alerts.map((a) => (
              <li key={a.id} style={{ display: "flex", gap: 12, padding: "16px 16px", borderRadius: 16, background: "rgba(240,160,32,0.10)", border: "1px solid rgba(240,160,32,0.22)" }}>
                <span style={{ fontSize: 20 }}>⚠️</span>
                <div>
                  <p style={{ font: "700 15px/1.3 var(--ff)" }}>{a.title}</p>
                  {a.body && <p style={{ font: "400 14px/1.5 var(--ff)", color: "#cdd2de", marginTop: 4 }}>{a.body}</p>}
                  {a.url && <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ font: "600 12px/1 var(--ff)", color: "#f0a020", marginTop: 8, display: "inline-block" }}>Más info ↗</a>}
                </div>
              </li>
            ))}
          </ul>
        )}

        <Link href="/" style={{ display: "block", textAlign: "center", height: 52, lineHeight: "52px", borderRadius: 16, background: "#f0a020", color: "#1a1206", font: "700 15px/52px var(--ff)", textDecoration: "none", marginTop: 28 }}>
          Abrir Cuándo
        </Link>
      </div>
    </main>
  );
}
