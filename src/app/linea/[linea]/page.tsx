import type { Metadata } from "next";
import { jsonLdHtml } from "@/lib/jsonld";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLineHeadsigns, getAllLineNames, getVariantsForLine, getStopsForVariant } from "@/lib/gtfs-db";
import { findStopServer } from "@/lib/stops-server";
import { lineColorFromCode } from "@/lib/stm";
import { fareLabel } from "@/lib/fare";
import { getServiceWindow } from "@/lib/line-hours";
import { SITE_URL } from "@/app/layout";

export const dynamic = "force-static";
export const revalidate = 86400;

// Pre-generar las páginas de todas las líneas en build (rápidas + indexables).
export function generateStaticParams() {
  try {
    return getAllLineNames().map((linea) => ({ linea }));
  } catch {
    return [];
  }
}

/**
 * Paradas representativas del recorrido (muestreo uniforme) con nombre real, para
 * interlinking SEO hacia /parada/{id}. Las paradas son nodos que la gente busca por
 * separado ("parada X"); enlazarlas reparte autoridad y arma la red interna.
 */
function getLineStopsSample(line: string, max = 12): Array<{ id: string; name: string }> {
  const variants = getVariantsForLine(line);
  if (!variants.length) return [];
  const stops = getStopsForVariant(variants[0].variantId);
  if (!stops.length) return [];
  const step = Math.max(1, Math.floor(stops.length / max));
  const out: Array<{ id: string; name: string }> = [];
  for (let i = 0; i < stops.length && out.length < max; i += step) {
    const rec = findStopServer(String(stops[i].stopId));
    if (rec) out.push({ id: rec.stopId, name: rec.stopName });
  }
  return out;
}

function describe(line: string) {
  const headsigns = getLineHeadsigns(line);
  const exists = headsigns.length > 0;
  const dests = headsigns.slice(0, 2).join(" y ");
  // El TÍTULO es la búsqueda literal de la gente: "cuándo pasa el 103". Nuestra marca
  // ("Cuándo") coincide con esa intención → ventaja semántica real.
  const title = `¿Cuándo pasa el ${line}?${dests ? ` ${dests}` : ""} — Horarios en vivo`;
  const desc = `¿Cuándo pasa el ${line}? Mirá en tiempo real cuándo llega el ${line} a tu parada${dests ? `, recorrido hacia ${dests}` : ""}. Horarios, paradas y mapa en vivo del transporte de Montevideo. Sin inventar: datos del STM.`;
  return { exists, headsigns, dests, title, desc };
}

export async function generateMetadata({ params }: { params: Promise<{ linea: string }> }): Promise<Metadata> {
  const { linea } = await params;
  const line = decodeURIComponent(linea);
  const { title, desc } = describe(line);
  return {
    title,
    description: desc,
    keywords: [`cuando pasa el ${line}`, `horario ${line}`, `recorrido ${line}`, `linea ${line} montevideo`, `${line} montevideo`, `omnibus ${line}`],
    alternates: { canonical: `/linea/${encodeURIComponent(line)}` },
    openGraph: { title: `¿Cuándo pasa el ${line}? · Cuándo`, description: desc, type: "article" },
    twitter: { card: "summary_large_image", title: `¿Cuándo pasa el ${line}? · Cuándo`, description: desc },
  };
}

export default async function LineaPage({ params }: { params: Promise<{ linea: string }> }) {
  const { linea } = await params;
  const line = decodeURIComponent(linea);
  const { exists, headsigns, dests } = describe(line);
  if (!exists) notFound();

  const color = lineColorFromCode(line);
  const stops = getLineStopsSample(line);
  const fare = fareLabel(0, false);
  // Ventana de días hábiles. OJO HONESTIDAD: ~157 líneas urbanas dan 00:00–24:00 (dato
  // saturado en la fuente, NO operan realmente 24h) → no afirmamos nada para esas. Solo
  // mostramos la ventana cuando es PARCIAL (las nocturnas/suburbanas/especiales: 495, 700…),
  // que es justo donde el horario importa y el dato es confiable.
  const rawWin = getServiceWindow(line, 1);
  const win = rawWin && !(rawWin.first === "00:00" && rawWin.last === "24:00") ? rawWin : null;
  const winShort = win ? `días hábiles ~${win.first}–${win.last}` : null;

  const faqs = [
    ...(win ? [{
      q: `¿A qué hora pasa el primer y el último ${line}?`,
      a: `En días hábiles, el ${line} arranca alrededor de las ${win.first} y el último servicio es cerca de las ${win.last}. Los fines de semana y feriados el horario puede cambiar; en Cuándo ves el horario en vivo según el día y la parada.`,
    }] : []),
    {
      q: `¿Cuándo pasa el ${line}?`,
      a: `Podés ver en tiempo real cuándo pasa el ${line} por tu parada en Cuándo. Mostramos la llegada del próximo bus según el GPS del STM, así sabés cuándo salir y no esperás de gusto.`,
    },
    {
      q: `¿Qué recorrido hace el ${line}?`,
      a: dests ? `El ${line} va hacia ${dests}. Mirá el recorrido completo, todas las paradas y por dónde pasa en el mapa en vivo.` : `Mirá el recorrido completo del ${line}, todas sus paradas y por dónde pasa en el mapa en vivo.`,
    },
    {
      q: `¿Cuánto sale el boleto del ${line}?`,
      a: `El boleto urbano sale ${fare.replace("~", "aprox. ")} (con tarjeta STM es más barato). Te mostramos el costo estimado de cada viaje, sin sorpresas.`,
    },
    {
      q: `¿El ${line} tiene aire acondicionado o piso bajo?`,
      a: `Depende del coche. En Cuándo te mostramos, cuando el dato está disponible, si el bus que viene tiene aire acondicionado o es accesible (piso bajo), antes de que llegue.`,
    },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Cuándo", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Líneas", item: `${SITE_URL}/linea/${encodeURIComponent(line)}` },
          { "@type": "ListItem", position: 3, name: `Línea ${line}` },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };

  return (
    <main style={{ position: "fixed", inset: 0, overflowY: "auto", background: "#070b14", color: "#eef0f5", fontFamily: "var(--ff)", padding: "calc(env(safe-area-inset-top) + 32px) 22px calc(40px + env(safe-area-inset-bottom))" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLd) }} />
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#9aa3b5", font: "600 13px/1 var(--ff)", marginBottom: 28 }}>← Cuándo</Link>

        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
          <span style={{ minWidth: 60, height: 60, borderRadius: 14, background: "rgba(255,255,255,0.07)", border: `2px solid ${color}`, display: "grid", placeItems: "center", font: "800 24px/1 var(--ff)", color: "#fff" }}>{line}</span>
          <div>
            <h1 style={{ font: "800 25px/1.1 var(--ff)", letterSpacing: "-0.02em" }}>¿Cuándo pasa el {line}?</h1>
            {headsigns.length > 0 && <p style={{ font: "500 14px/1.3 var(--ff)", color: "#9aa3b5", marginTop: 4 }}>{headsigns.join(" · ")}</p>}
          </div>
        </div>

        <p style={{ font: "400 16px/1.55 var(--ff)", color: "#cdd2de", marginBottom: 22 }}>
          Mirá <b>en tiempo real cuándo pasa el {line}</b> por tu parada. Te decimos cuándo llega el próximo
          bus y cuándo salir, con el recorrido completo y todas las paradas{dests ? ` hacia ${dests}` : ""} — sin inventar.
        </p>

        <a href={`/?linea=${encodeURIComponent(line)}`}
          style={{ display: "block", textAlign: "center", height: 54, lineHeight: "54px", borderRadius: 16, background: "#f0a020", color: "#1a1206", font: "700 16px/54px var(--ff)", textDecoration: "none", marginBottom: 8 }}>
          Ver cuándo pasa el {line}
        </a>
        <p style={{ font: "400 12px/1.4 var(--ff)", color: "#737c92", textAlign: "center", marginBottom: 26 }}>
          Boleto {fare}{winShort ? ` · ${winShort}` : " · llegadas en vivo del STM"}
        </p>

        {stops.length > 0 && (
          <section style={{ marginTop: 8 }}>
            <h2 style={{ font: "700 14px/1 var(--ff)", color: "#9aa3b5", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>Por dónde pasa el {line}</h2>
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
          <h2 style={{ font: "700 14px/1 var(--ff)", color: "#9aa3b5", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>Preguntas sobre el {line}</h2>
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
          Cuándo es la app de transporte de Uruguay con llegadas en vivo del STM, rutas inteligentes
          y mapa en tiempo real. Datos oficiales, sin trackers.
        </p>
      </div>
    </main>
  );
}
