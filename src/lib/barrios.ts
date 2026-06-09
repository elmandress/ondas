/**
 * Barrios de Montevideo para las landings SEO `/barrio/[slug]` ("bondis en X",
 * "qué líneas pasan por X"). Intención distinta a /a/[destino]: el destino es un punto
 * ("cómo llegar al aeropuerto"); el barrio es una zona donde la gente vive y busca
 * "qué bondis tengo en Pocitos / qué línea pasa por el Cordón".
 *
 * Centroides aproximados (no inventamos líneas: se derivan de las paradas reales del barrio).
 */
export interface Barrio {
  slug: string;
  name: string;
  /** Radio en metros para juntar las paradas del barrio (zonas chicas 600, grandes 900). */
  radiusM: number;
  lat: number;
  lon: number;
}

export const BARRIOS: Barrio[] = [
  { slug: "pocitos", name: "Pocitos", radiusM: 800, lat: -34.9119, lon: -56.1561 },
  { slug: "cordon", name: "Cordón", radiusM: 700, lat: -34.9036, lon: -56.1789 },
  { slug: "centro", name: "el Centro", radiusM: 700, lat: -34.9059, lon: -56.1913 },
  { slug: "punta-carretas", name: "Punta Carretas", radiusM: 750, lat: -34.9221, lon: -56.1567 },
  { slug: "parque-rodo", name: "Parque Rodó", radiusM: 700, lat: -34.9145, lon: -56.1707 },
  { slug: "la-blanqueada", name: "La Blanqueada", radiusM: 800, lat: -34.8889, lon: -56.1611 },
  { slug: "buceo", name: "Buceo", radiusM: 850, lat: -34.9036, lon: -56.1372 },
  { slug: "malvin", name: "Malvín", radiusM: 850, lat: -34.8917, lon: -56.1147 },
  { slug: "carrasco", name: "Carrasco", radiusM: 900, lat: -34.8836, lon: -56.0586 },
  { slug: "union", name: "la Unión", radiusM: 800, lat: -34.8731, lon: -56.1389 },
  { slug: "prado", name: "el Prado", radiusM: 900, lat: -34.8597, lon: -56.1944 },
  { slug: "aguada", name: "Aguada", radiusM: 700, lat: -34.8944, lon: -56.2008 },
  { slug: "palermo", name: "Palermo", radiusM: 700, lat: -34.9136, lon: -56.1844 },
  { slug: "parque-batlle", name: "Parque Batlle", radiusM: 800, lat: -34.8944, lon: -56.1583 },
  { slug: "reducto", name: "Reducto", radiusM: 700, lat: -34.8689, lon: -56.1872 },
  { slug: "la-teja", name: "La Teja", radiusM: 900, lat: -34.8519, lon: -56.2369 },
  { slug: "cerro", name: "el Cerro", radiusM: 1000, lat: -34.8908, lon: -56.2592 },
  { slug: "maronas", name: "Maroñas", radiusM: 900, lat: -34.8531, lon: -56.1294 },
  { slug: "sayago", name: "Sayago", radiusM: 900, lat: -34.8369, lon: -56.2106 },
  { slug: "colon", name: "Colón", radiusM: 1000, lat: -34.8060, lon: -56.2215 },
  { slug: "ciudad-vieja", name: "Ciudad Vieja", radiusM: 650, lat: -34.9070, lon: -56.2080 },
  { slug: "tres-cruces", name: "Tres Cruces", radiusM: 700, lat: -34.8945, lon: -56.1647 },
];

export function getBarrio(slug: string): Barrio | null {
  return BARRIOS.find((b) => b.slug === slug) ?? null;
}
