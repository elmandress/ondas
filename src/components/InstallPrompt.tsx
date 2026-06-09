"use client";

import { useEffect, useState } from "react";
import { track } from "@/lib/analytics";
import { Icons } from "@/components/brand/Icons";

/**
 * Banner de instalación PWA — distribución/retención: los usuarios que INSTALAN vuelven
 * mucho más (ícono en la pantalla, abre full-screen, anda offline). Sin esto, casi nadie
 * descubre que "Cuándo" se puede instalar.
 *
 * Respetuoso: discreto, descartable, y solo aparece si (a) el navegador ofrece instalación
 * nativa (beforeinstallprompt — Chrome/Edge/Android), (b) no está ya instalada, (c) no lo
 * descartaste antes. No insiste ni bloquea. iOS no expone el evento → no mostramos nada
 * inventado (sería un instructivo intrusivo); ahí la gente instala desde Compartir.
 */

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "cuando_install_dismissed";

export default function InstallPrompt() {
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  const [show, setShow] = useState(false);
  // iOS no expone beforeinstallprompt: la ÚNICA vía de instalar (y de recibir push) es
  // "Compartir → Agregar a inicio". Sin un hint, el usuario iOS nunca se entera. Lo
  // mostramos discreto y descartable (no un instructivo intrusivo).
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const standalone = window.matchMedia?.("(display-mode: standalone)").matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) return; // ya instalada
    try { if (localStorage.getItem(DISMISS_KEY) === "1") return; } catch { /* sin storage */ }

    const ua = navigator.userAgent;
    const isIOS = /iphone|ipad|ipod/i.test(ua);
    const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
    if (isIOS && isSafari) {
      const t = setTimeout(() => { setIosHint(true); track("install_hint_ios_shown"); }, 9000);
      return () => clearTimeout(t);
    }

    const onBIP = (e: Event) => {
      e.preventDefault(); // evita el mini-infobar nativo; lo mostramos nosotros lindo
      setEvt(e as BIPEvent);
      // Pequeño delay para no pisar el onboarding ni el primer vistazo.
      setTimeout(() => setShow(true), 8000);
      track("install_prompt_shown");
    };
    window.addEventListener("beforeinstallprompt", onBIP);
    return () => window.removeEventListener("beforeinstallprompt", onBIP);
  }, []);

  const dismiss = () => {
    setShow(false);
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* sin storage */ }
    track("install_prompt_dismissed");
  };

  const install = async () => {
    if (!evt) return;
    setShow(false);
    await evt.prompt();
    const choice = await evt.userChoice.catch(() => ({ outcome: "dismissed" as const }));
    track("install_prompt_choice", { outcome: choice.outcome });
    if (choice.outcome === "dismissed") {
      try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* sin storage */ }
    }
    setEvt(null);
  };

  // Hint iOS: instrucción clara (no hay botón programático en iPhone).
  if (iosHint) {
    return (
      <div className="install-prompt" role="dialog" aria-label="Instalar Cuándo en iPhone">
        <div className="ip-icon"><Icons.Download size={20} /></div>
        <div className="ip-text">
          <b>Agregá Cuándo a tu inicio</b>
          <span>Tocá <b>Compartir</b> ↑ y elegí <b>“Agregar a inicio”</b>. Queda como app y andás sin señal.</span>
        </div>
        <button className="ip-close" onClick={dismiss} aria-label="Entendido"><Icons.Close size={16} /></button>
      </div>
    );
  }

  if (!show || !evt) return null;

  return (
    <div className="install-prompt" role="dialog" aria-label="Instalar Cuándo">
      <div className="ip-icon"><Icons.Download size={20} /></div>
      <div className="ip-text">
        <b>Instalá Cuándo</b>
        <span>Acceso directo, pantalla completa y anda sin señal.</span>
      </div>
      <button className="ip-install" onClick={install}>Instalar</button>
      <button className="ip-close" onClick={dismiss} aria-label="Ahora no"><Icons.Close size={16} /></button>
    </div>
  );
}
