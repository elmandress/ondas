import type { Metadata } from "next";
import { jsonLdHtml } from "@/lib/jsonld";
import Link from "next/link";
import { DESTINOS, aDest } from "@/lib/destinos";
import { SITE_URL } from "@/app/layout";

export const dynamic = "force-static";
export const revalidate = 86400;

const TITLE = "Cómo llegar en ómnibus a los lugares más buscados de Montevideo";
const DESC = "Cómo llegar en bus a Tres Cruces, el Aeropuerto, las facultades, shoppings y los destinos más buscados de Montevideo. Qué líneas tomar y horarios en vivo.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  keywords: ["como llegar montevideo", "destinos montevideo bus", "que bus tomar montevideo"],
  alternates: { canonical: "/destinos" },
  openGraph: { title: `${TITLE} · Cuándo`, description: DESC, type: "website" },
};

export default function DestinosPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Cuándo", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Cómo llegar", item: `${SITE_URL}/destinos` },
    ],
  };
  return (
    <main style={{ position: "fixed", inset: 0, overflowY: "auto", background: "#070b14", color: "#eef0f5", fontFamily: "var(--ff)", padding: "calc(env(safe-area-inset-top) + 32px) 22px calc(40px + env(safe-area-inset-bottom))" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLd) }} />
      <div style={{ maxWidth: 620, margin: "0 auto" }}>
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#9aa3b5", font: "600 13px/1 var(--ff)", marginBottom: 24 }}>← Cuándo</Link>
        <h1 style={{ font: "800 26px/1.12 var(--ff)", letterSpacing: "-0.02em", marginBottom: 10 }}>¿Cómo llegar en ómnibus?</h1>
        <p style={{ font: "400 15px/1.55 var(--ff)", color: "#cdd2de", marginBottom: 24 }}>Elegí a dónde vas y te decimos qué bus tomar, con horarios en vivo.</p>
        <ul style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {DESTINOS.map((d) => (
            <li key={d.slug}>
              <Link href={`/a/${d.slug}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, font: "600 16px/1.3 var(--ff)", color: "#eef0f5", padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", textDecoration: "none" }}>
                <span>Cómo llegar {aDest(d.name)}</span>
                <span style={{ color: "#f0a020", font: "700 13px/1 var(--ff)" }}>→</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
