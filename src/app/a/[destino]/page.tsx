import type { Metadata } from "next";
import { jsonLdHtml } from "@/lib/jsonld";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DESTINOS, getDestino, aDest } from "@/lib/destinos";
import { getStopsServerSync } from "@/lib/stops-server";
import { haversineMeters } from "@/lib/geo";
import { lineColorFromCode } from "@/lib/stm";
import { SITE_URL } from "@/app/layout";

export const dynamic = "force-static";
export const revalidate = 86400;

export function generateStaticParams() {
  return DESTINOS.map((d) => ({ destino: d.slug }));
}

/** Líneas y paradas que dejan CERCA del destino (≤450 m). Dato real del GTFS, no inventado. */
function nearby(lat: number, lon: number) {
  const stops = getStopsServerSync();
  const close = stops
    .map((s) => ({ s, d: haversineMeters(lat, lon, s.stopLat, s.stopLon) }))
    .filter((x) => x.d <= 450)
    .sort((a, b) => a.d - b.d)
    .slice(0, 12);
  const lineSet = new Set<string>();
  for (const { s } of close) for (const l of s.lines) lineSet.add(l);
  return { stops: close.map((x) => ({ id: x.s.stopId, name: x.s.stopName, d: Math.round(x.d) })), lines: [...lineSet].sort((a, b) => a.localeCompare(b, "es", { numeric: true })) };
}

export async function generateMetadata({ params }: { params: Promise<{ destino: string }> }): Promise<Metadata> {
  const { destino } = await params;
  const d = getDestino(destino);
  if (!d) return {};
  const title = `¿Cómo llegar ${aDest(d.name)} en ómnibus? — Qué bus tomar`;
  const desc = `Cómo llegar a ${d.full} en bus: qué líneas te dejan cerca, las paradas y en tiempo real cuándo pasan. Planificá tu viaje en Montevideo con Cuándo.`;
  return {
    title,
    description: desc,
    keywords: [`como llegar a ${d.name}`, `bondi a ${d.name}`, `omnibus a ${d.name}`, `que bus va a ${d.name}`, ...d.aliases.map((a) => `como llegar a ${a}`)],
    alternates: { canonical: `/a/${d.slug}` },
    openGraph: { title: `¿Cómo llegar ${aDest(d.name)}? · Cuándo`, description: desc, type: "article" },
    twitter: { card: "summary_large_image", title: `¿Cómo llegar ${aDest(d.name)}? · Cuándo`, description: desc },
  };
}

export default async function DestinoPage({ params }: { params: Promise<{ destino: string }> }) {
  const { destino } = await params;
  const d = getDestino(destino);
  if (!d) notFound();

  const { stops, lines } = nearby(d.lat, d.lon);

  const faqs = [
    {
      q: `¿Cómo llegar a ${d.name} en ómnibus?`,
      a: lines.length ? `Para llegar a ${d.full} podés tomar las líneas ${lines.slice(0, 10).join(", ")}, que te dejan a pocos metros. En Cuándo planificás el viaje desde donde estés y ves en tiempo real cuándo pasa cada bus.` : `En Cuándo planificás cómo llegar a ${d.full} desde donde estés, con las líneas y horarios en tiempo real.`,
    },
    {
      q: `¿Qué bus me deja en ${d.name}?`,
      a: lines.length ? `Te dejan cerca de ${d.name} las líneas ${lines.slice(0, 12).join(", ")}. Tocá una para ver su recorrido completo y cuándo pasa.` : `Mirá en Cuándo qué líneas te dejan cerca de ${d.name}.`,
    },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Cuándo", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Cómo llegar", item: `${SITE_URL}/a/${d.slug}` },
          { "@type": "ListItem", position: 3, name: d.name },
        ],
      },
      { "@type": "FAQPage", mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
    ],
  };

  return (
    <main style={{ position: "fixed", inset: 0, overflowY: "auto", background: "#070b14", color: "#eef0f5", fontFamily: "var(--ff)", padding: "calc(env(safe-area-inset-top) + 32px) 22px calc(40px + env(safe-area-inset-bottom))" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLd) }} />
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#9aa3b5", font: "600 13px/1 var(--ff)", marginBottom: 24 }}>← Cuándo</Link>

        <h1 style={{ font: "800 25px/1.15 var(--ff)", letterSpacing: "-0.02em", marginBottom: 10 }}>¿Cómo llegar {aDest(d.name)} en ómnibus?</h1>
        <p style={{ font: "400 16px/1.55 var(--ff)", color: "#cdd2de", marginBottom: 20 }}>
          {lines.length ? <>Estas líneas te dejan cerca de <b>{d.full}</b>. Planificá el viaje desde donde estés y mirá <b>en tiempo real</b> cuándo pasa cada una.</> : <>Planificá cómo llegar a <b>{d.full}</b> desde donde estés, con horarios en vivo.</>}
        </p>

        <a href={`/?ir=${encodeURIComponent(d.slug)}`}
          style={{ display: "block", textAlign: "center", height: 54, lineHeight: "54px", borderRadius: 16, background: "#f0a020", color: "#1a1206", font: "700 16px/54px var(--ff)", textDecoration: "none", marginBottom: 26 }}>
          Planificá tu viaje {aDest(d.name)}
        </a>

        {lines.length > 0 && (
          <section style={{ marginTop: 4 }}>
            <h2 style={{ font: "700 14px/1 var(--ff)", color: "#9aa3b5", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>Líneas que te dejan cerca</h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {lines.map((l) => (
                <Link key={l} href={`/linea/${encodeURIComponent(l)}`} aria-label={`Cuándo pasa el ${l}`}
                  style={{ display: "inline-flex", alignItems: "center", height: 40, padding: "0 15px", borderRadius: 11, background: "rgba(255,255,255,0.05)", border: `1.5px solid ${lineColorFromCode(l)}`, color: "#eef0f5", font: "700 15px/1 var(--ff)", textDecoration: "none" }}>
                  {l}
                </Link>
              ))}
            </div>
          </section>
        )}

        {stops.length > 0 && (
          <section style={{ marginTop: 28 }}>
            <h2 style={{ font: "700 14px/1 var(--ff)", color: "#9aa3b5", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>Paradas cerca de {d.name}</h2>
            <ul style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {stops.slice(0, 6).map((s) => (
                <li key={s.id}>
                  <Link href={`/parada/${encodeURIComponent(s.id)}`}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, font: "500 15px/1.3 var(--ff)", color: "#eef0f5", padding: "11px 14px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", textDecoration: "none" }}>
                    <span>{s.name}</span>
                    <span style={{ color: "#737c92", font: "600 12px/1 var(--ff)" }}>{s.d} m →</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section style={{ marginTop: 30 }}>
          <h2 style={{ font: "700 14px/1 var(--ff)", color: "#9aa3b5", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>Preguntas</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {faqs.map((f) => (
              <div key={f.q} style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <h3 style={{ font: "700 15px/1.3 var(--ff)", color: "#eef0f5", marginBottom: 6 }}>{f.q}</h3>
                <p style={{ font: "400 14px/1.5 var(--ff)", color: "#cdd2de" }}>{f.a}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
