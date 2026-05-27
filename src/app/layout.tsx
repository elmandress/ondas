import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import PwaRegister from "@/components/PwaRegister";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ondas — Sabé cuándo salir",
  description: "La app de transporte más inteligente de Montevideo. Tiempo real, rutas favoritas y alertas de salida personalizadas.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Ondas",
  },
  openGraph: {
    title: "Ondas — Transporte de Montevideo",
    description: "Sabé cuándo salir de tu casa con tiempo real del STM.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#080d1a",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${geist.variable} h-full`} suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="h-full font-sans antialiased bg-[#080d1a] text-slate-100 overflow-hidden">
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
