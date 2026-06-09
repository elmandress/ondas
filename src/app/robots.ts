import type { MetadataRoute } from "next";
import { SITE_URL } from "@/app/layout";

/** robots.txt — permite indexar todo (es contenido público útil) y apunta al sitemap.
 *  Bloquea /api (no aporta SEO y evita rastreo de endpoints). */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
