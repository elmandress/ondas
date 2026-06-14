"use client";

import type { ReactNode } from "react";
import { Icons } from "@/components/brand/Icons";
import LineBadge from "@/components/ui/LineBadge";

/**
 * Lista de resultados de búsqueda de lugar, unificada (R68). Misma UI en las 3
 * superficies (Buscar / Ruteo / Guardar ruta). Mobile-first: cada fila es el touch
 * target (≥48px); las chapas son informativas dentro de la fila (la fila es la acción).
 */
export interface PlaceResultItem {
  key: string | number;
  name: string;
  /** Subtítulo: fragmento de dirección / "Parada #X" / barrio. */
  meta?: string;
  /** Ícono VECTORIAL (no emoji). Default: Pin. */
  icon?: ReactNode;
  /** Chapas de líneas asociadas (ej. una parada) — informativas. */
  lines?: string[];
  /** Acción/indicador a la derecha. Default: chevron. */
  trailing?: ReactNode;
}

export default function PlaceResults({
  items,
  onSelect,
}: {
  items: PlaceResultItem[];
  onSelect: (index: number) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="place-results">
      {items.map((it, i) => (
        <button key={it.key} className="place-result-row" onClick={() => onSelect(i)}>
          <span className="prr-icon">{it.icon ?? <Icons.Pin size={18} />}</span>
          <span className="prr-body">
            <span className="prr-name">{it.name}</span>
            {it.meta && <span className="prr-meta">{it.meta}</span>}
            {it.lines && it.lines.length > 0 && (
              <span className="prr-lines">
                {it.lines.slice(0, 6).map((l) => <LineBadge key={l} num={l} size="xs" />)}
                {it.lines.length > 6 && <span className="prr-more">+{it.lines.length - 6}</span>}
              </span>
            )}
          </span>
          <span className="prr-trail">{it.trailing ?? <Icons.Chevron size={16} />}</span>
        </button>
      ))}
    </div>
  );
}
