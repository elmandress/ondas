import type { Metadata } from "next";
import { jsonLdHtml } from "@/lib/jsonld";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BARRIOS, getBarrio } from "@/lib/barrios";
import { getStopsServerSync } from "@/lib/stops-server";
import { haversineMeters } from "@/lib/geo";
import { lineColorFromCode } from "@/lib/stm";
import { SITE_URL } from "@/app/layout";

export const dynamic = "force-static";
export const revalidate = 86400;

export function generateStaticParams() {
  return BARRIOS.map((b) => ({ barrio: b.slug }));
}

/** Líneas y paradas del barrio (paradas dentro del radio). Dato real del GTFS. */
function barrioData(lat: number, lon: number, radiusM: number) {
  const stops = getStopsServerSync();
  const inside = stops
    .map((s) => ({ s, d: haversineMeters(lat, lon, s.stopLat, s.stopLon) }))
    .filter((x) => x.d <= radiusM)
    .sort((a, b) => a.d - b.d);
  const lineSet = new Set<string>();
  for (const { s } of inside) for (const l of s.lines) lineSet.add(l);
  return {
    lines: [...lineSet].sort((a, b) => a.localeCompare(b, "es", { numeric: true })),
    stops: inside.slice(0, 8).map((x) => ({ id: x.s.stopId, name: x.s.stopName })),
    stopCount: inside.length,
  };
}

export async function generateMetadata({ params }: { params: Promise<{ barrio: string }> }): Promise<Metadata> {
  const { barrio } = await params;
  const b = getBarrio(barrio);
  if (!b) return {};
  const title = `Bondis en ${b.name} — qué líneas pasan y horarios`;
  const desc = `Qué ómnibus pasan por ${b.name}, Montevideo: todas las líneas del barrio, las paradas y en tiempo real cuándo pasan. Planificá tu viaje con Cuándo.`;
  return {
    title,
    description: desc,
    keywords: [`bondis en ${b.name}`, `que bus pasa por ${b.name}`, `lineas de ${b.name}`, `omnibus ${b.name} montevideo`, `transporte ${b.name}`],
    alternates: { canonical: `/barrio/${b.slug}` },
    openGraph: { title: `Bondis en ${b.name} · Cuándo`, description: desc, type: "article" },
    twitter: { card: "summary_large_image", title: `Bondis en ${b.name} · Cuándo`, description: desc },
  };
}

export default async function BarrioPage({ params }: { params: Promise<{ barrio: string }> }) {
  const { barrio } = await params;
  const b = getBarrio(barrio);
  if (!b) notFound();

  const { lines, stops, stopCount } = barrioData(b.lat, b.lon, b.radiusM);

  const faqs = [
    {
      q: `¿Qué bondis pasan por ${b.name}?`,
      a: lines.length ? `Por ${b.name} pasan ${lines.length} líneas: ${lines.slice(0, 14).join(", ")}${lines.length > 14 ? " y más" : ""}. En Cuándo ves en tiempo real cuándo pasa cada una por tu parada.` : `En Cuándo ves qué líneas pasan por ${b.name} y cuándo, en tiempo real.`,
    },
    {
      q: `¿Cómo me muevo en bus por ${b.name}?`,
      a: `Abrí Cuándo en ${b.name}: detectamos tu parada más cercana y te mostramos los próximos buses sin que busques nada. También planificás cualquier viaje desde acá.`,
    },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Cuándo", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Barrios", item: `${SITE_URL}/barrio/${b.slug}` },
          { "@type": "ListItem", position: 3, name: b.name },
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

        <h1 style={{ font: "800 26px/1.12 var(--ff)", letterSpacing: "-0.02em", marginBottom: 10 }}>Bondis en {b.name}</h1>
        <p style={{ font: "400 16px/1.55 var(--ff)", color: "#cdd2de", marginBottom: 20 }}>
          {lines.length ? <>Por {b.name} pasan <b>{lines.length} líneas</b> en <b>{stopCount} paradas</b>. Mirá <b>en tiempo real</b> cuándo pasa cada una.</> : <>Mirá qué líneas pasan por {b.name} y cuándo, en tiempo real.</>}
        </p>

        <Link href="/?tab=route"
          style={{ display: "block", textAlign: "center", height: 54, lineHeight: "54px", borderRadius: 16, background: "#f0a020", color: "#1a1206", font: "700 16px/54px var(--ff)", textDecoration: "none", marginBottom: 26 }}>
          Planificá tu viaje desde {b.name}
        </Link>

        {lines.length > 0 && (
          <section>
            <h2 style={{ font: "700 14px/1 var(--ff)", color: "#9aa3b5", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>Líneas que pasan por {b.name}</h2>
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
            <h2 style={{ font: "700 14px/1 var(--ff)", color: "#9aa3b5", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>Paradas en {b.name}</h2>
            <ul style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {stops.map((s) => (
                <li key={s.id}>
                  <Link href={`/parada/${encodeURIComponent(s.id)}`}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, font: "500 15px/1.3 var(--ff)", color: "#eef0f5", padding: "11px 14px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", textDecoration: "none" }}>
                    <span>{s.name}</span>
                    <span style={{ color: "#737c92", font: "600 12px/1 var(--ff)" }}>llegadas →</span>
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
