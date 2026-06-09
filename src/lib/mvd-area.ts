/**
 * Área de cobertura de Montevideo + metropolitano. Una sola fuente para los bounds y la
 * validación de coordenadas (antes estaban duplicados e inconsistentes en route/plan:
 * un helper `inMvd` sin chequeo de finitud + comparaciones inline que dejaban pasar NaN).
 */
export const MVD_BOUNDS = { minLat: -35.0, maxLat: -34.6, minLon: -56.5, maxLon: -55.8 } as const;

/**
 * ¿La coordenada es válida (número finito) y está dentro del área de cobertura?
 * Rechaza NaN/Infinity explícitamente (`typeof NaN === "number"` se colaba por las
 * comparaciones de bounds, que con NaN son siempre false).
 */
export function isValidMvdCoord(lat: unknown, lon: unknown): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  const la = lat as number, lo = lon as number;
  return la >= MVD_BOUNDS.minLat && la <= MVD_BOUNDS.maxLat && lo >= MVD_BOUNDS.minLon && lo <= MVD_BOUNDS.maxLon;
}
