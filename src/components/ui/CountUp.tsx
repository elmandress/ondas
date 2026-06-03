"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Número que ANIMA hacia su valor (count-up) — el detalle que hace que un contador
 * se sienta "vivo" e inteligente, como Uber/Citymapper. Cuando el valor cambia (ej. el
 * ETA pasa de 8 a 7 min), el número sube/baja con un tween corto en vez de saltar.
 *
 * Respeta prefers-reduced-motion (accesibilidad): si el usuario pidió menos movimiento,
 * muestra el valor directo sin animar.
 */
export default function CountUp({ value, durationMs = 600, className }: { value: number; durationMs?: number; className?: string }) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const from = fromRef.current;
    const to = value;
    if (reduce || from === to) { setDisplay(to); fromRef.current = to; return; }

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // easeOutCubic — arranca rápido, frena suave (se siente premium).
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value, durationMs]);

  return <span className={className}>{display}</span>;
}
