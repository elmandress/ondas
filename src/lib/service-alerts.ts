/**
 * Desvíos y avisos de servicio.
 *
 * REALIDAD investigada (jun 2026): la API oficial de transporte de la IM NO expone
 * un endpoint de alertas/desvíos (confirmado en api.montevideo.gub.uy/apidocs). La IM
 * publica los cortes y desvíos como NOTICIAS en su web y en su cuenta oficial de Twitter
 * @MvdTransporte. No hay feed estructurado (GTFS-realtime alerts) disponible.
 *
 * Por eso NO scrapeamos (sería frágil y se rompería). El enfoque honesto: dar acceso
 * DIRECTO a las fuentes oficiales, claras y al día, en el momento en que el usuario las
 * necesita (planificando un viaje / mirando una parada). Cuando la IM publique un feed
 * estructurado, se reemplaza este acceso por alertas filtradas por línea (ver TODO).
 */

export interface AlertSource {
  label: string;
  sublabel: string;
  url: string;
}

/** Fuentes OFICIALES de desvíos/avisos de transporte de Montevideo (verificadas). */
export const SERVICE_ALERT_SOURCES: AlertSource[] = [
  {
    label: "Cortes y desvíos de la IM",
    sublabel: "Página oficial de movilidad — obras y desvíos al día",
    url: "https://montevideo.gub.uy/movilidad",
  },
  {
    label: "@MvdTransporte",
    sublabel: "Cuenta oficial de avisos de transporte (X/Twitter)",
    url: "https://twitter.com/MvdTransporte",
  },
];

// TODO (cuando exista feed estructurado de la IM): importar alertas, resumirlas en
// lenguaje simple ("el 121 no pasa por X por obras, tomalo en Y") y mostrar SOLO las
// que afectan a las líneas/paradas del usuario.
