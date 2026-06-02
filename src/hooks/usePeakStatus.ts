"use client";

import { useEffect, useState } from "react";
import { getPeakStatus, type PeakStatus } from "@/lib/peak-hours";

/**
 * Devuelve el estado de hora pico actual (Montevideo) y lo refresca cada minuto,
 * para que el aviso aparezca/desaparezca solo al entrar/salir de la franja.
 */
export function usePeakStatus(): PeakStatus {
  const [status, setStatus] = useState<PeakStatus>(() => getPeakStatus());

  useEffect(() => {
    const tick = () => setStatus(getPeakStatus());
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  return status;
}
