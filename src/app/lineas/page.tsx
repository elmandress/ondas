import type { Metadata } from "next";
import { jsonLdHtml } from "@/lib/jsonld";
import Link from "next/link";
import { getAllLineNames } from "@/lib/gtfs-db";
import { lineColorFromCode } from "@/lib/stm";
import { SITE_URL } from "@/app/layout";

export const dynamic = "force-static";
export const revalidate = 86400;

const TITLE = "Todas las líneas de ómnibus de Montevideo — Horarios y recorridos";
const DESC = "Lista completa de líneas de ómnibus de Montevideo y área metropolitana. Mirá el recorrido, las paradas y en tiempo real cuándo pasa cada línea del STM.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  keywords: ["lineas de omnibus montevideo", "lineas de bus montevideo", "todas las lineas stm", "recorridos montevideo", "horarios omnibus montevideo"],
  alternates: { canonical: "/lineas" },
  openGraph: { title: `${TITLE} · Cuándo`, description: DESC, type: "website" },
  twitter: { card: "summary_large_image", title: "Líneas de ómnibus de Montevideo · Cuándo", description: DESC },
};

export default function LineasPage() {
  let lines: string[] = [];
  try { lines = getAllLineNames(); } catch { lines = []; }

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Cuándo", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Líneas", item: `${SITE_URL}/lineas` },
        ],
      },
      {
        "@type": "CollectionPage",
        name: TITLE,
        url: `${SITE_URL}/lineas`,
        about: "Líneas de ómnibus del transporte público de Montevideo, Uruguay",
        numberOfItems: lines.length,
      },
    ],
  };

  return (
    <main style={{ position: "fixed", inset: 0, overflowY: "auto", background: "#070b14", color: "#eef0f5", fontFamily: "var(--ff)", padding: "calc(env(safe-area-inset-top) + 32px) 22px calc(40px + env(safe-area-inset-bottom))" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLd) }} />
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#9aa3b5", font: "600 13px/1 var(--ff)", marginBottom: 24 }}>← Cuándo</Link>

        <h1 style={{ font: "800 26px/1.1 var(--ff)", letterSpacing: "-0.02em", marginBottom: 10 }}>Líneas de ómnibus de Montevideo</h1>
        <p style={{ font: "400 15px/1.55 var(--ff)", color: "#cdd2de", marginBottom: 24 }}>
          Elegí una línea para ver su <b>recorrido</b>, sus <b>paradas</b> y <b>en tiempo real cuándo pasa</b>.
          {lines.length > 0 && <> {lines.length} líneas del STM y área metropolitana.</>}
        </p>

        {lines.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))", gap: 8 }}>
            {lines.map((l) => (
              <Link key={l} href={`/linea/${encodeURIComponent(l)}`}
                aria-label={`Cuándo pasa el ${l}`}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 46, borderRadius: 11, background: "rgba(255,255,255,0.05)", border: `1.5px solid ${lineColorFromCode(l)}`, color: "#eef0f5", font: "700 15px/1 var(--ff)", textDecoration: "none" }}>
                {l}
              </Link>
            ))}
          </div>
        ) : (
          <p style={{ color: "#737c92" }}>No pudimos cargar las líneas ahora.</p>
        )}

        <p style={{ font: "400 13px/1.5 var(--ff)", color: "#737c92", marginTop: 30 }}>
          Cuándo es la app de transporte de Uruguay con llegadas en vivo del STM, rutas inteligentes y mapa
          en tiempo real. Datos oficiales, sin trackers.
        </p>
      </div>
    </main>
  );
}
