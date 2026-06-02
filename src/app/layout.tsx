import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import PwaRegister from "@/components/PwaRegister";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Cuándo — El bondi te espera. Vos no.",
  description: "Sabé cuándo salir. Llegadas en tiempo real, rutas inteligentes y mapa en vivo del transporte de Montevideo.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Cuándo",
  },
  openGraph: {
    title: "Cuándo — Transporte de Montevideo",
    description: "El bondi te espera. Vos no. Tiempo real del STM.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#070b14",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${jakarta.variable} ${jetbrainsMono.variable} h-full`} suppressHydrationWarning>
      <head>
        {/* Fija el tema ANTES de pintar (sin parpadeo). Default oscuro (marca);
            si no hay preferencia guardada, sigue al dispositivo. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=localStorage.getItem('cuando_theme');var t;if(m==='light'||m==='dark'){t=m;}else{var h=new Date().getHours();var night=h>=19||h<7;var lite=window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches;t=night?'dark':(lite?'light':'dark');}document.documentElement.setAttribute('data-theme',t);if(localStorage.getItem('cuando_text_size')==='grande'){document.documentElement.classList.add('text-grande');}}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`,
          }}
        />
        <meta name="theme-color" content="#070b14" />
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
      </head>
      <body className="h-full antialiased overflow-hidden" style={{ color: "var(--text)" }}>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
