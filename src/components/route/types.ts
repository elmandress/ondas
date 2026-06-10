/** Lugar elegible como origen/destino/waypoint en Cómo Ir (parada, dirección o POI). */
export interface Place {
  name: string;
  subtitle?: string;
  lat: number;
  lon: number;
  icon?: string;
}
