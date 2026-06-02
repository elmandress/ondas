"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LogoMark } from "@/components/brand/Logo";
import { Icons } from "@/components/brand/Icons";
import { useLocation } from "@/hooks/useLocation";
import { getNearbyStopsClient, distanceTo } from "@/lib/utils";
import { addFavoriteStop } from "@/lib/favorite-stops";
import { setOnboardingDone } from "@/lib/store";

// Velocidad peatonal usada en todo el motor (≈4.3 km/h = 1.2 m/s). Misma que el planner,
// para que el tiempo a pie del onboarding coincida con el del resto de la app (sin inventar).
const WALK_SPEED_MS = 1.2;

/**
 * Primer uso — 4 pantallas (brand book "08 — ONBOARDING"): bienvenida, ubicación,
 * tu parada de casa, y listo. Sin cuentas, sin tutoriales largos: < 15 segundos.
 * Usa el look de marca (oscuro) a propósito, independiente del tema elegido.
 */

// Colores de marca (fijos — es la primera impresión, siempre en oscuro de marca).
const C = {
  bg: "#070b14",
  text: "#eef0f5",
  dim: "#9aa3b5",
  dim2: "#5c647a",
  accent: "#f0a020",
  panel: "#0d1422",
  border: "rgba(255,255,255,0.08)",
};

export default function OnboardingFlow({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const { location, retry } = useLocation();
  // Parada de casa elegida (para mostrar datos REALES en el cierre, no un número inventado).
  const [homeStop, setHomeStop] = useState<{ stopName: string; lines: string[]; walkMin: number } | null>(null);
  const next = () => setStep((s) => s + 1);

  function finish() {
    setOnboardingDone(true);
    onDone();
  }

  const nearby = location?.isReal ? getNearbyStopsClient(location.lat, location.lon, 700, 4) : [];

  function pickHome(stop: { stopId: string; stopCode: string; stopName: string; lines: string[]; stopLat: number; stopLon: number }) {
    addFavoriteStop({
      stopId: stop.stopId,
      stopCode: stop.stopCode,
      stopName: stop.stopName,
      lines: stop.lines,
      alias: "Casa",
    });
    // Tiempo a pie REAL desde la ubicación a la parada (si la tenemos). Sin esto, no
    // mostramos minutos en el cierre (honestidad: no inventamos un "8 min").
    let walkMin = 0;
    if (location?.isReal) {
      const m = distanceTo(location.lat, location.lon, stop.stopLat, stop.stopLon);
      walkMin = Math.max(1, Math.round(m / WALK_SPEED_MS / 60));
    }
    setHomeStop({ stopName: stop.stopName, lines: stop.lines, walkMin });
    next();
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, zIndex: 300, background: C.bg, fontFamily: "var(--ff)" }}
    >
      {/* Progreso (4 puntitos) */}
      {step > 0 && (
        <div style={{ position: "absolute", top: "calc(env(safe-area-inset-top) + 18px)", left: 0, right: 0, display: "flex", justifyContent: "center", gap: 7, zIndex: 2 }}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} style={{ width: i === step ? 22 : 7, height: 7, borderRadius: 999, background: i === step ? C.accent : "rgba(255,255,255,0.18)", transition: "all .25s" }} />
          ))}
        </div>
      )}
      {/* Saltar */}
      {step > 0 && step < 3 && (
        <button onClick={finish} style={{ position: "absolute", top: "calc(env(safe-area-inset-top) + 12px)", right: 18, color: C.dim2, font: "600 14px/1 var(--ff)", background: "none", zIndex: 2, padding: 8 }}>
          Saltar
        </button>
      )}

      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div key="splash" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            style={{ height: "100%", background: "radial-gradient(120% 90% at 50% 18%, #16223a, #070b14 65%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 32px calc(40px + env(safe-area-inset-bottom))" }}>
            <LogoMark size={84} ring={C.text} dot={C.accent} />
            <div style={{ font: "800 34px/1 var(--ff)", color: C.text, letterSpacing: "-0.02em", marginTop: 24 }}>Cuándo</div>
            <div style={{ font: "500 15px/1.4 var(--ff)", color: C.dim, marginTop: 12, textAlign: "center" }}>Tu transporte en todo Uruguay, claro y al instante.</div>

            {/* Tres cosas clave — qué podés hacer, de un vistazo. */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 36, width: "100%", maxWidth: 340 }}>
              {[
                { icon: <Icons.Clock size={20} />, t: "Cuándo salir", s: "Te avisamos a qué hora irte para no perder el bondi." },
                { icon: <Icons.Bus size={20} />, t: "Buses en vivo", s: "Dónde está cada bus, en Montevideo y el interior." },
                { icon: <Icons.Route size={20} />, t: "Cómo llegar", s: "La mejor combinación, sin mentirte ni inventar." },
              ].map((f, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, textAlign: "left" }}>
                  <span style={{ width: 44, height: 44, borderRadius: 13, flexShrink: 0, display: "grid", placeItems: "center", background: "rgba(232,148,10,0.12)", color: C.accent }}>{f.icon}</span>
                  <div>
                    <div style={{ font: "700 16px/1.2 var(--ff)", color: C.text }}>{f.t}</div>
                    <div style={{ font: "400 13.5px/1.35 var(--ff)", color: C.dim, marginTop: 2 }}>{f.s}</div>
                  </div>
                </div>
              ))}
            </div>

            <button onClick={next} style={{ marginTop: 38, height: 54, width: "100%", maxWidth: 340, borderRadius: 16, background: C.accent, color: "#1a1206", font: "700 16px/1 var(--ff)", border: "none" }}>
              Empezar
            </button>
          </motion.div>
        )}

        {step === 1 && (
          <motion.div key="loc" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}
            style={{ height: "100%", padding: "100px 30px calc(40px + env(safe-area-inset-bottom))", display: "flex", flexDirection: "column" }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", gap: 26 }}>
              <div style={{ width: 110, height: 110, borderRadius: "50%", background: "rgba(232,148,10,0.10)", border: "1px solid rgba(232,148,10,0.22)", display: "grid", placeItems: "center", color: C.accent }}>
                <Icons.Pin size={48} />
              </div>
              <div style={{ font: "700 26px/1.2 var(--ff)", color: C.text, letterSpacing: "-0.02em" }}>¿Dónde estás?</div>
              <div style={{ font: "400 16px/1.5 var(--ff)", color: C.dim, maxWidth: 290 }}>Con tu ubicación calculamos cuánto tardás a pie hasta la parada — y cuándo salir. No la guardamos.</div>
            </div>
            <button onClick={() => { retry(); next(); }} style={{ height: 54, borderRadius: 16, background: C.accent, color: "#1a1206", font: "700 16px/1 var(--ff)", border: "none" }}>
              Permitir ubicación
            </button>
            <button onClick={next} style={{ height: 50, color: C.dim, font: "600 15px/1 var(--ff)", background: "none", marginTop: 6 }}>Ahora no</button>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div key="home" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}
            style={{ height: "100%", padding: "100px 30px calc(40px + env(safe-area-inset-bottom))", display: "flex", flexDirection: "column", overflowY: "auto" }}>
            <div style={{ font: "700 26px/1.2 var(--ff)", color: C.text, letterSpacing: "-0.02em" }}>¿Cuál es tu parada de casa?</div>
            <div style={{ font: "400 15px/1.5 var(--ff)", color: C.dim, marginTop: 12 }}>La guardamos como 🏠 Casa para el acceso rápido. Podés cambiarla después.</div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 22 }}>
              {nearby.length === 0 ? (
                <div style={{ font: "400 14px/1.5 var(--ff)", color: C.dim2, padding: "20px 0" }}>
                  {location?.isReal ? "No encontramos paradas cerca." : "Activá la ubicación para ver tus paradas cercanas, o saltá este paso."}
                </div>
              ) : (
                nearby.map((s) => (
                  <button key={s.stopId} onClick={() => pickHome(s)}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: 13, borderRadius: 14, background: C.panel, border: `1px solid ${C.border}`, textAlign: "left" }}>
                    <span style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(232,148,10,0.12)", display: "grid", placeItems: "center", color: C.accent, flexShrink: 0 }}>
                      <Icons.Bus size={16} />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ font: "600 13px/1.2 var(--ff)", color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.stopName}</div>
                      <div style={{ font: "500 12px/1 var(--ff)", color: C.dim2, marginTop: 4 }}>{s.lines.length} líneas</div>
                    </div>
                    <Icons.Star size={18} />
                  </button>
                ))
              )}
            </div>
            <button onClick={next} style={{ height: 50, color: C.dim, font: "600 15px/1 var(--ff)", background: "none", marginTop: 18 }}>Omitir por ahora</button>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div key="ready" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
            style={{ height: "100%", padding: "120px 26px calc(40px + env(safe-area-inset-bottom))", display: "flex", flexDirection: "column" }}>
            <div style={{ flex: 1 }}>
              <div style={{ font: "800 40px/1 var(--ff)", color: C.text, letterSpacing: "-0.03em" }}>Listo.</div>
              <div style={{ font: "400 16px/1.5 var(--ff)", color: C.dim, marginTop: 12, marginBottom: 28 }}>Salí tranquilo — nosotros contamos los minutos.</div>

              {homeStop ? (
                // CIERRE FUNCIONAL: muestra la parada de casa REAL elegida y, si tenemos
                // ubicación, el tiempo a pie real. Nada inventado.
                <div style={{ background: "linear-gradient(135deg, rgba(232,148,10,0.10), rgba(232,148,10,0.02))", border: "1px solid rgba(232,148,10,0.22)", borderRadius: 18, padding: 22 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, font: "600 12px/1 var(--ff)", color: C.dim2, letterSpacing: "0.04em" }}>
                    🏠 TU PARADA DE CASA
                  </div>
                  <div style={{ font: "800 22px/1.2 var(--ff)", color: C.text, letterSpacing: "-0.02em", marginTop: 10 }}>{homeStop.stopName}</div>
                  <div style={{ display: "flex", gap: 18, marginTop: 14, alignItems: "baseline" }}>
                    {homeStop.walkMin > 0 && (
                      <div>
                        <span style={{ font: "800 30px/1 var(--ff)", color: C.accent }} className="tnum">{homeStop.walkMin}</span>
                        <span style={{ font: "600 14px/1 var(--ff)", color: C.dim }}> min a pie</span>
                      </div>
                    )}
                    {homeStop.lines.length > 0 && (
                      <div>
                        <span style={{ font: "800 30px/1 var(--ff)", color: C.text }} className="tnum">{homeStop.lines.length}</span>
                        <span style={{ font: "600 14px/1 var(--ff)", color: C.dim }}> {homeStop.lines.length === 1 ? "línea" : "líneas"}</span>
                      </div>
                    )}
                  </div>
                  <div style={{ font: "500 13px/1.4 var(--ff)", color: C.dim, marginTop: 14 }}>
                    {homeStop.walkMin > 0
                      ? "Te avisamos a qué hora salir de casa para no perder el bondi."
                      : "Activá la ubicación cuando salgas y te decimos cuándo arrancar."}
                  </div>
                </div>
              ) : (
                // Sin parada de casa: mensaje honesto de qué puede hacer, sin números falsos.
                <div style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, borderRadius: 18, padding: 22 }}>
                  <div style={{ font: "700 17px/1.3 var(--ff)", color: C.text }}>Todo listo para empezar.</div>
                  <div style={{ font: "500 14px/1.5 var(--ff)", color: C.dim, marginTop: 10 }}>
                    Buscá tu destino en <b style={{ color: C.text }}>Rutas</b>, mirá los buses en vivo en el <b style={{ color: C.text }}>Mapa</b>, o guardá tu parada de casa cuando quieras desde <b style={{ color: C.text }}>Inicio</b>.
                  </div>
                </div>
              )}
            </div>
            <button onClick={finish} style={{ height: 54, borderRadius: 16, background: C.accent, color: "#1a1206", font: "700 16px/1 var(--ff)", border: "none" }}>
              Empezar a usar Cuándo
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
