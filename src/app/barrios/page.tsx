import type { Metadata } from "next";
import { jsonLdHtml } from "@/lib/jsonld";
import Link from "next/link";
import { BARRIOS } from "@/lib/barrios";
import { SITE_URL } from "@/app/layout";

export const dynamic = "force-static";
export const revalidate = 86400;

const TITLE = "Bondis por barrio en Montevideo — qué líneas pasan por cada zona";
const DESC = "Qué ómnibus pasan por cada barrio de Montevideo: Pocitos, Cordón, Centro, Carrasco, La Teja, el Cerro y más. Líneas, paradas y llegadas en vivo.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  keywords: ["bondis montevideo por barrio", "lineas por barrio montevideo", "que bus pasa por mi barrio"],
  alternates: { canonical: "/barrios" },
  openGraph: { title: `${TITLE} · Cuándo`, description: DESC, type: "website" },
};

export default function BarriosPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Cuándo", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Barrios", item: `${SITE_URL}/barrios` },
    ],
  };
  return (
    <main style={{ position: "fixed", inset: 0, overflowY: "auto", background: "#070b14", color: "#eef0f5", fontFamily: "var(--ff)", padding: "calc(env(safe-area-inset-top) + 32px) 22px calc(40px + env(safe-area-inset-bottom))" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLd) }} />
      <div style={{ maxWidth: 620, margin: "0 auto" }}>
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#9aa3b5", font: "600 13px/1 var(--ff)", marginBottom: 24 }}>← Cuándo</Link>
        <h1 style={{ font: "800 26px/1.12 var(--ff)", letterSpacing: "-0.02em", marginBottom: 10 }}>Bondis por barrio</h1>
        <p style={{ font: "400 15px/1.55 var(--ff)", color: "#cdd2de", marginBottom: 24 }}>Mirá qué líneas pasan por tu barrio y cuándo, en tiempo real.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 }}>
          {BARRIOS.map((b) => (
            <Link key={b.slug} href={`/barrio/${b.slug}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, font: "600 15px/1.2 var(--ff)", color: "#eef0f5", padding: "14px 15px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", textDecoration: "none" }}>
              <span>{b.name}</span>
              <span style={{ color: "#f0a020", font: "700 13px/1 var(--ff)" }}>→</span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
