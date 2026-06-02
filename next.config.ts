import type { NextConfig } from "next";

/**
 * Config para deploy serverless (Vercel) + empaquetado.
 *
 * 1) better-sqlite3 es un módulo NATIVO (.node): hay que excluirlo del bundling
 *    de Server Components / Route Handlers para que use require() nativo.
 *
 * 2) Los .db / .json se leen en runtime con fs desde process.cwd(): el file-tracing
 *    de Next NO los detecta solo (no son imports). Los incluimos a mano en las API.
 *    Total incluido ≈ 8 MB (bien por debajo del límite ~50 MB de funciones Vercel).
 *
 * 3) schedule.db (84 MB) NO entra en serverless y la app degrada bien sin él
 *    (las ETAs salen del GTFS). Lo excluimos explícitamente. gtfs.db (v1) es solo
 *    fallback de gtfs-v2.db (presente), tampoco hace falta.
 */
const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],

  // Seguridad (best practices 2026):
  //  - poweredByHeader:false → no revelar que es Next.js (menos superficie de ataque).
  //  - productionBrowserSourceMaps:false → no exponer el código fuente original en prod.
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  reactStrictMode: true,

  // Tree-shaking más agresivo de paquetes grandes con muchos exports: solo entra al
  // bundle lo que realmente usamos (reduce JS inicial → carga más rápida, menos datos).
  experimental: {
    optimizePackageImports: ["framer-motion"],
  },

  outputFileTracingIncludes: {
    "/api/**": [
      "./data/gtfs-v2.json",
      "./data/line-hours.json",
      "./data/mvd-pois.json",
      "./data/variant_to_line.json",
      "./data/metro-schedule.db",
      "./data/interior-stops.json",
      "./public/routes.json",
      "./public/stops.json",
      // Estos viven en public/ pero se leen con fs en el server (no como estáticos),
      // así que Next NO los tracea solo → hay que listarlos o fallan en prod
      // (interdepartamentales y geocoding del interior).
      "./public/interdept.json",
      "./public/interior-cities.json",
    ],
  },

  outputFileTracingExcludes: {
    "/api/**": ["./data/schedule.db", "./data/gtfs.db"],
  },
};

export default nextConfig;
