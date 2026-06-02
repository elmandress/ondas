"use client";

import { useState, useEffect } from "react";

/**
 * `false` durante SSR y el primer render del cliente; `true` tras montar.
 * Sirve para gatear UI que depende de APIs solo-cliente (ej. Web Speech) y evitar
 * mismatches de hidratación (server renderiza sin el botón, cliente lo agrega luego).
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
