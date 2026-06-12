"use client";

/**
 * Botón ATRÁS del sistema cierra el sheet/panel (no la app) — R58c, raíz real R59d.
 *
 * Por qué esta forma (aprendido a los golpes, ver FABLE §21+):
 *  1. Bug original: ningún sheet pusheaba history → atrás cerraba la app entera.
 *  2. Primer intento (pushState + leer history.state en popstate): el App Router de
 *     Next TAMBIÉN escucha popstate y "restaura" la ruta → REMONTA el árbol de la
 *     página → todo el estado del cliente (sheets, tab, selección) se perdía. Con
 *     dos sheets apilados, un back cerraba ambos.
 *  3. Fix definitivo: UN listener global de popstate en fase CAPTURA (corre antes
 *     que el de Next, que es bubble) que, si hay sheets nuestros abiertos, hace
 *     stopImmediatePropagation() → Next nunca procesa ese pop → cero re-render.
 *     Mantenemos pila propia de closers; el pop cierra SOLO el del tope.
 *     El "consumo" al cerrar por UI (✕/backdrop/drag) también se blinda con un flag
 *     para que ese history.back() interno tampoco le llegue a Next.
 *
 * Uso: useBackClose(handleClose) en el componente del sheet (monta al abrir),
 *      o useBackClose(handler, anyPanelOpen) para paneles siempre montados.
 */
import { useEffect, useRef } from "react";

let seq = 0;
const stack: number[] = [];
const closers = new Map<number, () => void>();
/** true mientras consumimos NUESTRA entrada con history.back() (cierre por UI). */
let consuming = false;
let installed = false;

function installGlobalListener() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener(
    "popstate",
    (e) => {
      if (consuming) {
        // back() interno de consumo: no es del usuario; que Next tampoco lo vea.
        consuming = false;
        e.stopImmediatePropagation();
        return;
      }
      if (stack.length === 0) return; // sin sheets → navegación real, Next decide
      e.stopImmediatePropagation(); // Next no procesa → no remonta la página
      const id = stack.pop()!;
      const close = closers.get(id);
      closers.delete(id);
      close?.();
    },
    true // CAPTURA: garantiza correr antes que el listener (bubble) del router
  );
}

export function useBackClose(onClose: () => void, active: boolean = true) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!active || typeof window === "undefined") return;
    installGlobalListener();
    const id = ++seq;
    try {
      // Entrada propia preservando el state del router (por si Next la inspecciona).
      window.history.pushState({ ...(window.history.state || {}), __sheet: id }, "");
    } catch { return; }
    stack.push(id);
    closers.set(id, () => onCloseRef.current());

    return () => {
      // Cerrado por UI: consumir nuestra entrada solo si seguimos en el tope
      // (si se cerró por back, el listener global ya la sacó de la pila).
      if (stack[stack.length - 1] === id) {
        stack.pop();
        closers.delete(id);
        consuming = true;
        try { window.history.back(); } catch { consuming = false; }
      } else {
        closers.delete(id);
      }
    };
  }, [active]);
}
