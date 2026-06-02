/**
 * CUÁNDO — Logo (mark + wordmark + lockup).
 *
 * Concepto: un anillo casi completo cuya abertura mira hacia adelante (derecha),
 * alcanzando un punto líder.
 *   · se lee como una "C" (Cuándo)
 *   · se lee como un anillo de cuenta regresiva (tiempo)
 *   · la abertura + punto líder se leen como salida/dirección (movimiento)
 */

interface LogoMarkProps {
  size?: number;
  /** Color del anillo. */
  ring?: string;
  /** Color del punto líder. */
  dot?: string;
  /** Fuerza un único color (favicon / impresión a 1 tinta). */
  mono?: string;
}

export function LogoMark({ size = 32, ring = "currentColor", dot = "var(--accent)", mono }: LogoMarkProps) {
  const r = mono || ring;
  const d = mono || dot;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-label="Cuándo" role="img">
      <path
        d="M 33.24 12.18 A 15 15 0 1 0 33.24 35.82"
        stroke={r}
        strokeWidth={size <= 20 ? 7 : 6}
        strokeLinecap="round"
      />
      <circle cx="42" cy="24" r={size <= 20 ? 4 : 3.6} fill={d} />
    </svg>
  );
}

export function LogoWord({ size = 22, color = "var(--text)" }: { size?: number; color?: string }) {
  return (
    <span
      style={{
        font: `800 ${size}px/1 var(--ff)`,
        color,
        letterSpacing: "-0.025em",
        whiteSpace: "nowrap",
      }}
    >
      Cuándo
    </span>
  );
}

interface LockupProps {
  size?: number;
  ring?: string;
  dot?: string;
  color?: string;
  mono?: string;
  gap?: number;
}

export function LogoLockup({
  size = 26,
  ring = "var(--text)",
  dot = "var(--accent)",
  color = "var(--text)",
  mono,
  gap = 11,
}: LockupProps) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap }}>
      <LogoMark size={size} ring={ring} dot={dot} mono={mono} />
      <LogoWord size={Math.round(size * 0.85)} color={mono || color} />
    </span>
  );
}
