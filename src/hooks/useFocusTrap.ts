"use client";

/**
 * Focus-trap accesible para bottom-sheets / paneles modales (R70).
 *
 * No hay un SheetHost único — cada sheet (StopArrivalSheet, LineDetailSheet, SettingsSheet,
 * VehicleCard, RoutePanel, PlacePanel, SaldoSheet…) renderiza su propio contenedor. La unidad
 * compartida es ESTE hook: una sola implementación, aplicada en la raíz de cada sheet.
 *
 * Qué resuelve (axe no lo detecta — es de comportamiento; medido roto en la auditoría R70:
 * el foco no entraba, no se atrapaba y no volvía al disparador):
 *   1. ENTRAR: al montar mueve el foco adentro (al contenedor, sin abrir el teclado virtual;
 *      si un input ya tiene autofocus —buscadores— lo respeta).
 *   2. ATRAPAR: Tab/Shift+Tab ciclan SOLO dentro del sheet (wrap en los bordes) → el foco no
 *      se escapa detrás del backdrop a contenido oculto.
 *   3. VOLVER: al desmontar restaura el foco al elemento que lo tenía al abrir.
 *
 * Semántica de STACK (sin manager central, sale gratis del patrón captura/restaura):
 *   - Pila global de traps; SOLO el del tope atrapa → con sheets apilados (drill-down) el Tab
 *     se queda en el hijo, no en el padre de abajo.
 *   - drill-down: cuando el hijo monta, el activeElement es el botón del PADRE que lo abrió →
 *     el hijo lo captura y restaura a él al cerrar (back) → el foco vuelve al padre, no al
 *     disparador original. El padre, a su vez, capturó el disparador original → vuelve a él al
 *     cerrar el último de la pila. Espeja la pila de `useBackClose`.
 *
 * Uso: useFocusTrap(ref, active) en el componente del sheet, con ref a su contenedor raíz.
 */
import { useEffect } from "react";
import type { RefObject } from "react";

interface TrapEntry { el: HTMLElement; }
const trapStack: TrapEntry[] = [];
let keydownInstalled = false;

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement
  );
}

function onKeydown(e: KeyboardEvent) {
  if (e.key !== "Tab") return;
  const top = trapStack[trapStack.length - 1];
  if (!top || !document.contains(top.el)) return;
  const focusables = getFocusable(top.el);
  if (focusables.length === 0) { e.preventDefault(); top.el.focus({ preventScroll: true }); return; }
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const active = document.activeElement as HTMLElement | null;
  const inside = top.el.contains(active);
  if (e.shiftKey) {
    if (!inside || active === first) { e.preventDefault(); last.focus({ preventScroll: true }); }
  } else {
    if (!inside || active === last) { e.preventDefault(); first.focus({ preventScroll: true }); }
  }
}

function installKeydown() {
  if (keydownInstalled || typeof document === "undefined") return;
  keydownInstalled = true;
  // CAPTURA: corre antes que handlers de la página (consistente con useBackClose).
  document.addEventListener("keydown", onKeydown, true);
}

export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean = true): void {
  useEffect(() => {
    if (!active || typeof document === "undefined") return;
    const el = ref.current;
    if (!el) return;
    installKeydown();
    const restoreTo = document.activeElement as HTMLElement | null;
    // Guardamos también el aria-label del disparador: algunos contenedores (p.ej. el header
    // del Home) RE-RENDERIZAN el botón al cerrar el sheet → el nodo capturado queda detached.
    // Si pasa, restauramos re-buscando el trigger por su label (el nodo nuevo tiene el mismo).
    const restoreLabel = restoreTo?.getAttribute?.("aria-label") || null;
    // tabindex para poder enfocar el contenedor (anuncia el diálogo sin abrir teclado).
    if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
    const entry: TrapEntry = { el };
    trapStack.push(entry);
    // Mover el foco adentro en el próximo frame (deja montar/animar el sheet). Si un input
    // ya quedó con foco (autofocus de buscadores), NO lo pisamos → el teclado virtual aparece
    // donde corresponde y no de más.
    const raf = requestAnimationFrame(() => {
      if (document.activeElement && el.contains(document.activeElement) && document.activeElement !== document.body) return;
      el.focus({ preventScroll: true });
    });
    return () => {
      cancelAnimationFrame(raf);
      const i = trapStack.indexOf(entry);
      if (i >= 0) trapStack.splice(i, 1);
      // Restaurar el foco al disparador (o, en drill-down, al elemento del padre).
      // En un rAF: deja que el re-render del cierre (que puede recrear el trigger) asiente.
      requestAnimationFrame(() => {
        let target: HTMLElement | null =
          restoreTo && typeof restoreTo.focus === "function" && document.contains(restoreTo) ? restoreTo : null;
        // Trigger re-renderizado (nodo capturado detached) → re-buscar por aria-label, el
        // primero VISIBLE (a 375px el botón mobile gana; el desktop está display:none).
        if (!target && restoreLabel) {
          const candidates = Array.from(
            document.querySelectorAll<HTMLElement>(`[aria-label="${(window.CSS && CSS.escape) ? CSS.escape(restoreLabel) : restoreLabel}"]`)
          );
          target = candidates.find((c) => c.offsetWidth > 0 || c.offsetHeight > 0) || null;
        }
        target?.focus({ preventScroll: true });
      });
    };
  }, [active, ref]);
}
