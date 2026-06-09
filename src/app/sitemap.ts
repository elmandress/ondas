import type { MetadataRoute } from "next";
import { SITE_URL } from "@/app/layout";
import { getAllLineNames } from "@/lib/gtfs-db";
import { getStopsServerSync } from "@/lib/stops-server";
import { DESTINOS } from "@/lib/destinos";
import { BARRIOS } from "@/lib/barrios";

export const dynamic = "force-static";
export const revalidate = 86400; // 1 día — se regenera del GTFS/paradas a diario

/**
 * Sitemap dinámico y COMPLETO (se arma de los datos reales, revalida cada día):
 *   - páginas fijas (/ , /desvios)
 *   - una URL por LÍNEA (~230)  → "recorrido 121 montevideo"
 *   - una URL por PARADA con ≥2 líneas (~6.3k) → nodos de transporte que la gente busca
 *     ("qué bus pasa por tal esquina"). Excluimos las de 1 sola línea (4k): son contenido
 *     fino y de baja demanda — calidad sobre cantidad para no diluir el índice.
 *
 * Total ~6.5k URLs, holgado bajo el límite de 50k de Google. Prioridades: home 1 >
 * líneas 0.7 > paradas-nodo 0.5.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/lineas`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/destinos`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/barrios`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/desvios`, lastModified: now, changeFrequency: "hourly", priority: 0.8 },
    ...DESTINOS.map((d) => ({ url: `${SITE_URL}/a/${d.slug}`, lastModified: now, changeFrequency: "monthly" as const, priority: 0.7 })),
    ...BARRIOS.map((b) => ({ url: `${SITE_URL}/barrio/${b.slug}`, lastModified: now, changeFrequency: "monthly" as const, priority: 0.7 })),
  ];

  let linePages: MetadataRoute.Sitemap = [];
  try {
    linePages = getAllLineNames().map((line) => ({
      url: `${SITE_URL}/linea/${encodeURIComponent(line)}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));
  } catch {
    /* sin GTFS en build → solo estáticas */
  }

  let stopPages: MetadataRoute.Sitemap = [];
  try {
    stopPages = getStopsServerSync()
      .filter((s) => (s.lines?.length ?? 0) >= 2) // nodos reales, no thin content
      .map((s) => ({
        url: `${SITE_URL}/parada/${encodeURIComponent(s.stopId)}`,
        lastModified: now,
        changeFrequency: "weekly" as const,
        priority: 0.5,
      }));
  } catch {
    /* sin stops.json → omitimos paradas */
  }

  return [...staticPages, ...linePages, ...stopPages];
}
