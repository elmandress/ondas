import type { Metadata, Viewport } from "next";
import { jsonLdHtml } from "@/lib/jsonld";
import { Plus_Jakarta_Sans, JetBrains_Mono, Archivo } from "next/font/google";
import "./globals.css";
import PwaRegister from "@/components/PwaRegister";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

// "Señal" (R67): grotesca de señalética para chapas de línea, el contador-tablero y
// los eyebrows. Archivo es variable (eje wght + wdth), OFL, y next/font la auto-subsetea
// a latin y la self-hostea (sin CDN, sin violar la CSP `font-src 'self'`). El eje wdth nos
// da el condensado REAL (no sintético) vía font-stretch. Solo carga donde se usa.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

// URL pública del sitio (para OG/canonical absolutos). Configurable por env; fallback al
// dominio de Netlify. Necesaria para que las previews de WhatsApp/X/Telegram resuelvan bien.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://cuando.uy";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Cuándo — El bondi te espera. Vos no.",
    template: "%s · Cuándo",
  },
  description: "Sabé cuándo salir. Llegadas en tiempo real, rutas inteligentes y mapa en vivo del transporte de Montevideo y todo Uruguay.",
  applicationName: "Cuándo",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Cuándo",
  },
  openGraph: {
    title: "Cuándo — Transporte de Montevideo",
    description: "El bondi te espera. Vos no. Llegadas en tiempo real del STM.",
    type: "website",
    locale: "es_UY",
    siteName: "Cuándo",
  },
  twitter: {
    card: "summary_large_image",
    title: "Cuándo — Transporte de Montevideo",
    description: "El bondi te espera. Vos no. Llegadas en tiempo real del STM.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Permitir zoom (WCAG 2.1 AA · 1.4.4): bloquearlo con maximumScale/userScalable
  // excluye a quien necesita agrandar. Vale más la accesibilidad que el look "nativo".
  themeColor: "#0E1116",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${jakarta.variable} ${jetbrainsMono.variable} ${archivo.variable} h-full`} suppressHydrationWarning>
      <head>
        {/* R67: dark-only — fija el tema antes de pintar (sin parpadeo). El selector
            light se deprecó; siempre oscuro (identidad "señalética" nocturna). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{document.documentElement.setAttribute('data-theme','dark');document.documentElement.style.background='#0E1116';if(localStorage.getItem('cuando_text_size')==='grande'){document.documentElement.classList.add('text-grande');}}catch(e){document.documentElement.setAttribute('data-theme','dark');document.documentElement.style.background='#0E1116';}})();`,
          }}
        />
        <meta name="theme-color" content="#0E1116" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        {/* Preconectar a los orígenes externos para acortar la 1ª llamada (TLS/DNS ya listos). */}
        <link rel="preconnect" href="https://api.montevideo.gub.uy" crossOrigin="" />
        <link rel="preconnect" href="https://a.basemaps.cartocdn.com" crossOrigin="" />
        <link rel="dns-prefetch" href="https://b.basemaps.cartocdn.com" />
        <link rel="dns-prefetch" href="https://c.basemaps.cartocdn.com" />
        <link rel="dns-prefetch" href="https://d.basemaps.cartocdn.com" />
        <link rel="dns-prefetch" href="https://routing.openstreetmap.de" />
        <link rel="dns-prefetch" href="https://nominatim.openstreetmap.org" />
        {/* Identidad del sitio para Google (nombre, logo, sitio oficial). */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLdHtml({
              "@context": "https://schema.org",
              "@graph": [
                { "@type": "Organization", name: "Cuándo", url: SITE_URL, logo: `${SITE_URL}/icons/icon-512.png` },
                {
                  "@type": "WebSite",
                  name: "Cuándo",
                  url: SITE_URL,
                  inLanguage: "es-UY",
                  description: "Llegadas en tiempo real, rutas inteligentes y mapa en vivo del transporte de Montevideo.",
                  potentialAction: {
                    "@type": "SearchAction",
                    target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/?q={search_term_string}` },
                    "query-input": "required name=search_term_string",
                  },
                },
              ],
            }),
          }}
        />
      </head>
      <body className="h-full antialiased overflow-hidden" style={{ color: "var(--text)" }}>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
