/**
 * Destinos frecuentes para las landings SEO `/a/[destino]` ("cómo llegar a X en bus").
 *
 * Captura la intención de búsqueda más común que NO es por línea/parada:
 *   "cómo llegar a tres cruces", "bondi al aeropuerto", "ómnibus a facultad de ingeniería".
 * Maprab no tiene estas páginas → tráfico orgánico nuestro.
 *
 * Curado a mano (no generado): cada destino es un lugar real y buscado, con coords
 * razonables para listar las líneas que dejan cerca (dato real, no inventado).
 */
export interface Destino {
  slug: string;
  name: string;        // nombre para el título ("Tres Cruces")
  full: string;        // nombre descriptivo ("la Terminal Tres Cruces")
  lat: number;
  lon: number;
  /** Búsquedas alternativas para keywords. */
  aliases: string[];
}

export const DESTINOS: Destino[] = [
  { slug: "tres-cruces", name: "Tres Cruces", full: "la Terminal Tres Cruces", lat: -34.8945, lon: -56.1647, aliases: ["terminal tres cruces", "shopping tres cruces"] },
  { slug: "aeropuerto-de-carrasco", name: "el Aeropuerto de Carrasco", full: "el Aeropuerto Internacional de Carrasco", lat: -34.8384, lon: -56.0308, aliases: ["aeropuerto carrasco", "aeropuerto montevideo", "bondi al aeropuerto"] },
  { slug: "facultad-de-ingenieria", name: "Facultad de Ingeniería", full: "la Facultad de Ingeniería (Udelar)", lat: -34.9181, lon: -56.1671, aliases: ["fing", "ingenieria udelar"] },
  { slug: "antel-arena", name: "el Antel Arena", full: "el Antel Arena", lat: -34.8780, lon: -56.1546, aliases: ["antel arena", "como llegar antel arena"] },
  { slug: "estadio-centenario", name: "el Estadio Centenario", full: "el Estadio Centenario", lat: -34.8943, lon: -56.1525, aliases: ["centenario", "estadio centenario"] },
  { slug: "portones-shopping", name: "Portones Shopping", full: "Portones Shopping", lat: -34.8869, lon: -56.0742, aliases: ["portones", "portones shopping"] },
  { slug: "pocitos", name: "Pocitos", full: "el barrio Pocitos", lat: -34.9119, lon: -56.1561, aliases: ["bondi a pocitos", "playa pocitos"] },
  { slug: "ciudad-vieja", name: "Ciudad Vieja", full: "la Ciudad Vieja", lat: -34.9070, lon: -56.2080, aliases: ["ciudad vieja montevideo"] },
  { slug: "punta-carretas-shopping", name: "Punta Carretas Shopping", full: "Punta Carretas Shopping", lat: -34.9221, lon: -56.1567, aliases: ["punta carretas", "punta carretas shopping"] },
  { slug: "facultad-de-medicina", name: "Facultad de Medicina", full: "la Facultad de Medicina (Hospital de Clínicas)", lat: -34.9112, lon: -56.1758, aliases: ["hospital de clinicas", "medicina udelar"] },
  { slug: "mercado-agricola", name: "el Mercado Agrícola", full: "el Mercado Agrícola (MAM)", lat: -34.8896, lon: -56.1717, aliases: ["mam", "mercado agricola montevideo"] },
  { slug: "montevideo-shopping", name: "Montevideo Shopping", full: "Montevideo Shopping", lat: -34.9036, lon: -56.1372, aliases: ["montevideo shopping", "world trade center"] },
];

export function getDestino(slug: string): Destino | null {
  return DESTINOS.find((d) => d.slug === slug) ?? null;
}

/** Contracción correcta: "a el Aeropuerto" → "al Aeropuerto"; "a Tres Cruces" se queda. */
export function aDest(name: string): string {
  if (name.startsWith("el ")) return `al ${name.slice(3)}`;
  return `a ${name}`;
}
