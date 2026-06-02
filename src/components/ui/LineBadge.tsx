/**
 * Badge de línea — NEUTRO por defecto (un solo tratamiento para todas las líneas).
 *
 * Decisión de diseño (v2): los colores por línea eran un hash inventado (no son
 * oficiales del STM) y al haber muchas líneas generaban un arcoíris que ensuciaba
 * toda la UI. El número identifica la línea; el color se reserva para significado
 * real (estado en vivo, acento de marca). Más limpio, más serio, más honesto.
 *
 * `tinted` permite teñir puntualmente si en algún lugar hiciera falta (no usado hoy).
 */
type BadgeSize = "xs" | "sm" | "md" | "lg";

export default function LineBadge({
  num,
  size = "md",
  tinted,
  color,
}: {
  num: string;
  size?: BadgeSize;
  tinted?: boolean;
  color?: string;
}) {
  const style = tinted && color
    ? { background: color, color: "#fff", border: "none" }
    : undefined; // neutro: lo define la clase .line-badge en globals.css
  return (
    <span className={`line-badge ${size}`} style={style}>
      {num}
    </span>
  );
}
