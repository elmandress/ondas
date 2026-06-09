import type { Metadata } from "next";
import { jsonLdHtml } from "@/lib/jsonld";
import Link from "next/link";
import { notFound } from "next/navigation";
import { findStopServer } from "@/lib/stops-server";
import { lineColorFromCode } from "@/lib/stm";
import { SITE_URL } from "@/app/layout";

// ISR on-demand: 10k+ paradas no se pre-generan en build (sería pesadísimo);
// se renderizan en la primera visita y se cachean como estáticas por 1 día.
export const revalidate = 86400;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

function describe(id: string) {
  const stop = findStopServer(id);
  if (!stop) return { stop: null, title: `Parada ${id}`, desc: "" };
  const lines = stop.lines || [];
  const linesTxt = lines.length ? lines.slice(0, 10).join(", ") : "";
  // Title = la búsqueda real ("qué bus pasa por…") + el nº de parada (la otra forma de buscar).
  const title = `¿Qué bus pasa por ${stop.stopName}? — Parada ${stop.stopCode}`;
  const desc = `¿Qué ómnibus pasa por ${stop.stopName} (parada ${stop.stopCode}), Montevideo? Mirá en tiempo real qué buses llegan y cuándo pasan.${linesTxt ? ` Líneas: ${linesTxt}.` : ""}`;
  return { stop, title, desc, lines };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const sid = decodeURIComponent(id);
  const { stop, title, desc } = describe(sid);
  return {
    title,
    description: desc,
    keywords: stop ? [`parada ${stop.stopCode}`, `que bus pasa por ${stop.stopName}`, `que omnibus para en ${stop.stopName}`, `paradas montevideo`, `llegadas parada ${stop.stopCode}`] : undefined,
    alternates: { canonical: `/parada/${encodeURIComponent(sid)}` },
    openGraph: { title: `${title} · Cuándo`, description: desc, type: "article" },
    twitter: { card: "summary_large_image", title: `${title} · Cuándo`, description: desc },
  };
}

export default async function ParadaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const stopId = decodeURIComponent(id);
  const { stop } = describe(stopId);
  if (!stop) notFound();

  const lines = stop.lines || [];
  const linesList = lines.length ? lines.join(", ") : "";

  const faqs = [
    {
      q: `¿Qué bus pasa por ${stop.stopName}?`,
      a: lines.length ? `Por la parada ${stop.stopCode} (${stop.stopName}) pasan las líneas ${linesList}. En Cuándo ves en tiempo real cuál llega primero y cuándo pasa.` : `En Cuándo ves en tiempo real qué buses llegan a la parada ${stop.stopCode} (${stop.stopName}) y cuándo pasan.`,
    },
    {
      q: `¿Cuándo pasa el próximo bus por la parada ${stop.stopCode}?`,
      a: `Mostramos la llegada en vivo del próximo bus en ${stop.stopName} según el GPS del STM, así sabés exactamente cuánto falta y no esperás de gusto.`,
    },
    {
      q: `¿Dónde queda la parada ${stop.stopCode}?`,
      a: `La parada ${stop.stopCode} está en ${stop.stopName}, Montevideo. Abrila en Cuándo para ver la ubicación exacta en el mapa y los buses en vivo.`,
    },
  ];

  // Rich snippets: Google entiende que es una parada de bus real (con geo) y muestra
  // las migas + las preguntas frecuentes en el resultado. Datos reales, nada inventado.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BusStop",
        name: stop.stopName,
        identifier: stop.stopCode,
        url: `${SITE_URL}/parada/${encodeURIComponent(stopId)}`,
        geo: { "@type": "GeoCoordinates", latitude: stop.stopLat, longitude: stop.stopLon },
        address: { "@type": "PostalAddress", addressLocality: "Montevideo", addressCountry: "UY" },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Cuándo", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Paradas", item: `${SITE_URL}/parada/${encodeURIComponent(stopId)}` },
          { "@type": "ListItem", position: 3, name: `Parada ${stop.stopCode}` },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
    ],
  };

  return (
    <main style={{ position: "fixed", inset: 0, overflowY: "auto", background: "#070b14", color: "#eef0f5", fontFamily: "var(--ff)", padding: "calc(env(safe-area-inset-top) + 32px) 22px calc(40px + env(safe-area-inset-bottom))" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLd) }} />
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#9aa3b5", font: "600 13px/1 var(--ff)", marginBottom: 28 }}>← Cuándo</Link>

        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 18 }}>
          <span style={{ minWidth: 52, height: 52, borderRadius: 14, background: "rgba(240,160,32,0.12)", border: "1px solid rgba(240,160,32,0.3)", display: "grid", placeItems: "center", fontSize: 24 }}>🚏</span>
          <div>
            <p style={{ font: "600 12px/1 var(--ff)", color: "#f0a020", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 6 }}>Parada {stop.stopCode} · {stop.stopName}</p>
            <h1 style={{ font: "800 22px/1.18 var(--ff)", letterSpacing: "-0.02em" }}>¿Qué bus pasa por {stop.stopName}?</h1>
          </div>
        </div>

        <p style={{ font: "400 15px/1.55 var(--ff)", color: "#cdd2de", marginBottom: 18 }}>
          {lines.length ? <>Por esta parada pasan <b>{lines.length} {lines.length === 1 ? "línea" : "líneas"}</b>. Mirá <b>en tiempo real</b> cuál llega primero y cuándo.</> : <>Mirá <b>en tiempo real</b> qué buses llegan a esta parada y cuándo pasan.</>}
        </p>

        <a href={`/?parada=${encodeURIComponent(stopId)}`}
          style={{ display: "block", textAlign: "center", height: 54, lineHeight: "54px", borderRadius: 16, background: "#f0a020", color: "#1a1206", font: "700 16px/54px var(--ff)", textDecoration: "none", margin: "8px 0 14px" }}>
          Ver llegadas en vivo
        </a>

        {lines.length > 0 && (
          <section style={{ marginTop: 24 }}>
            <h2 style={{ font: "700 14px/1 var(--ff)", color: "#9aa3b5", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>Líneas que paran acá</h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {lines.map((l) => (
                <Link key={l} href={`/linea/${encodeURIComponent(l)}`}
                  style={{ display: "inline-flex", alignItems: "center", height: 38, padding: "0 14px", borderRadius: 11, background: "rgba(255,255,255,0.05)", border: `1.5px solid ${lineColorFromCode(l)}`, color: "#eef0f5", font: "700 14px/1 var(--ff)", textDecoration: "none" }}>
                  {l}
                </Link>
              ))}
            </div>
          </section>
        )}

        <section style={{ marginTop: 30 }}>
          <h2 style={{ font: "700 14px/1 var(--ff)", color: "#9aa3b5", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>Preguntas sobre esta parada</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {faqs.map((f) => (
              <div key={f.q} style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <h3 style={{ font: "700 15px/1.3 var(--ff)", color: "#eef0f5", marginBottom: 6 }}>{f.q}</h3>
                <p style={{ font: "400 14px/1.5 var(--ff)", color: "#cdd2de" }}>{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        <p style={{ font: "400 13px/1.5 var(--ff)", color: "#737c92", marginTop: 30 }}>
          Cuándo te muestra las llegadas en vivo de esta parada con datos oficiales del STM.
          Tocá una línea para ver su recorrido completo y cuándo pasa.
        </p>
      </div>
    </main>
  );
}
