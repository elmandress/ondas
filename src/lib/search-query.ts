/**
 * Búsqueda inicial pendiente: permite que un deep link `/?q=texto` (o el sitelinks
 * searchbox de Google, vía SearchAction schema) aterrice en la pantalla Buscar con el
 * término ya cargado. Patrón "take-once": se consume una sola vez al montar SearchScreen.
 */
let _pending: string | null = null;

export function setPendingSearch(q: string): void {
  _pending = q;
}

export function takePendingSearch(): string | null {
  const v = _pending;
  _pending = null;
  return v;
}
