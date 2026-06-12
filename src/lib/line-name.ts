/**
 * Canonicalización de nombres de línea para comparar entre FUENTES distintas.
 *
 * El mismo bus aparece con distinta capitalización según de dónde venga el dato:
 *   - GPS en vivo (api.montevideo.gub.uy / stm-online): "CE1", "124 SD"
 *   - GTFS oficial (gtfs-v2.json): "Ce1", "124 Sd"
 *   - variant_to_line.json (schedule.db): "CE2", "BT1"
 *
 * Comparar con === entre fuentes hacía que líneas enteras (Ce1/Ce2/Bt1/Bt2…)
 * quedaran SIN filtro de dirección, sin horarios y sin ETA por recorrido
 * (auditoría R57). Toda comparación de líneas entre fuentes debe pasar por acá.
 */
export function canonLine(line: string): string {
  return line.trim().replace(/\s+/g, " ").toUpperCase();
}

/** ¿Son la misma línea comercial, sin importar la fuente? */
export function sameLine(a: string, b: string): boolean {
  return canonLine(a) === canonLine(b);
}
