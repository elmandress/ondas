"use client";

/**
 * Saldo y recarga de la tarjeta STM.
 *
 * Decisión de diseño (R56, ver FABLE.md §16): NO consultamos el saldo desde nuestro
 * servidor. La consulta oficial pide la CÉDULA + el código de la tarjeta y devuelve
 * HTML por un form JSF frágil; intermediarla nos obligaría a manejar PII y se rompería
 * en cada cambio de su sitio. Coherente con nuestros principios ("no te pedimos tu
 * cédula"), esta pantalla es un HUB honesto: enruta a los canales oficiales y le da
 * CONTEXTO al saldo (cuántos boletos rinde), que es lo que la app sí puede aportar.
 */
import { useState, useEffect, useCallback } from "react";
import { useBackClose } from "@/hooks/useBackClose";
import { Icons } from "@/components/brand/Icons";
import { URBAN_FARES, FARE_VIGENCIA, boletosFromSaldo } from "@/lib/fare";
import { track } from "@/lib/analytics";

const CLOSE_MS = 340;

const OFICIAL_CONSULTA = "https://montevideo.gub.uy/app/stm/beneficios/";
const OFICIAL_STM = "https://montevideo.gub.uy/stm-en-linea";

export default function SaldoSheet({ onClose }: { onClose: () => void }) {
  // Atrás del sistema cierra el sheet, no la app (R58c).
  useBackClose(onClose);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const handleClose = useCallback(() => {
    setOpen(false);
    setTimeout(onClose, CLOSE_MS);
  }, [onClose]);

  // "¿Cuánto saldo tengo?" no lo sabemos; pero "¿cuánto rinde?" sí. El usuario teclea
  // su saldo y le decimos cuántos boletos comunes le quedan — contexto útil y honesto.
  const [saldo, setSaldo] = useState("");
  const boletos = boletosFromSaldo(parseFloat(saldo.replace(",", ".")));

  const openOfficial = (url: string, what: string) => {
    track("saldo_stm_open", { what });
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <>
      <div className={`sheet-backdrop mobile-only ${open ? "open" : ""}`} onClick={handleClose} />
      <div className={`bottom-sheet ${open ? "open" : ""}`}>
        <div className="sheet-handle" />

        <div className="sheet-header">
          <div className="icon" style={{ background: "var(--live-soft)", color: "var(--live)" }}>
            <span style={{ fontSize: 22 }}>💳</span>
          </div>
          <div className="text">
            <div className="eyebrow">Tarjeta STM</div>
            <div className="name">Saldo y recarga</div>
          </div>
          <div className="actions">
            <button className="icon-btn sm" onClick={handleClose} aria-label="Cerrar"><Icons.Close size={18} /></button>
          </div>
        </div>

        <div className="sheet-arrivals scrollbar-none" style={{ paddingBottom: 16 }}>
          <div style={{ padding: "4px 22px 0" }}>
            {/* Acciones oficiales (lo principal) */}
            <button
              onClick={() => openOfficial(OFICIAL_CONSULTA, "consulta")}
              className="tap-card"
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 13, padding: "15px 16px", borderRadius: "var(--r-card)", background: "var(--accent-bg)", color: "#1a1206", border: "none", marginBottom: 10 }}
            >
              <span style={{ display: "grid", placeItems: "center", flexShrink: 0 }}><Icons.Bus size={20} /></span>
              <span style={{ flex: 1, textAlign: "left" }}>
                <span style={{ display: "block", font: "800 15px/1.2 var(--ff)" }}>Consultar mi saldo</span>
                <span style={{ display: "block", font: "600 12px/1.3 var(--ff)", opacity: 0.8 }}>En el sitio oficial del STM</span>
              </span>
              <span style={{ flexShrink: 0 }}>↗</span>
            </button>

            <button
              onClick={() => openOfficial(OFICIAL_STM, "recarga")}
              className="tap-card"
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 13, padding: "13px 16px", borderRadius: "var(--r-card)", background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border)", marginBottom: 18 }}
            >
              <span style={{ color: "var(--live)", display: "grid", placeItems: "center", flexShrink: 0 }}>💳</span>
              <span style={{ flex: 1, textAlign: "left" }}>
                <span style={{ display: "block", font: "700 14px/1.2 var(--ff)" }}>Recargar la tarjeta</span>
                <span style={{ display: "block", font: "500 12px/1.3 var(--ff)", color: "var(--text-3)" }}>STM en línea · recarga y trámites</span>
              </span>
              <span style={{ flexShrink: 0, color: "var(--text-3)" }}>↗</span>
            </button>

            {/* Por qué te mandamos al sitio oficial (transparencia = confianza) */}
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "12px 14px", borderRadius: "var(--r-card)", background: "var(--surface)", border: "1px solid var(--border)", marginBottom: 18 }}>
              <span style={{ color: "var(--text-2)", flexShrink: 0, marginTop: 1 }}><Icons.Star size={16} /></span>
              <p style={{ font: "400 12.5px/1.55 var(--ff)", color: "var(--text-2)", margin: 0 }}>
                Para ver el saldo, el STM te pide tu documento y el código de la tarjeta. Te llevamos
                directo a su sitio oficial: <b>tu cédula nunca pasa por Cuándo</b>. Es parte de cómo
                cuidamos tus datos.
              </p>
            </div>

            {/* Contexto que SÍ aportamos: cuánto rinde tu saldo */}
            <div className="eyebrow" style={{ marginBottom: 8 }}>¿Cuánto te rinde el saldo?</div>
            <div style={{ display: "flex", gap: 9, alignItems: "center" }}>
              <div style={{ position: "relative", flex: 1 }}>
                <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)", font: "600 15px/1 var(--ff)" }}>$</span>
                <input
                  type="number" inputMode="decimal" placeholder="Tu saldo"
                  value={saldo} onChange={(e) => setSaldo(e.target.value)}
                  aria-label="Saldo de tu tarjeta en pesos"
                  style={{ width: "100%", padding: "12px 12px 12px 26px", borderRadius: "var(--r-chip)", background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", font: "600 15px/1 var(--ff)" }}
                />
              </div>
            </div>
            {boletos !== null && (
              <div role="status" style={{ marginTop: 10, padding: "12px 14px", borderRadius: "var(--r-card)", background: "var(--live-soft)", border: "1px solid rgba(14,164,114,0.28)" }}>
                <span style={{ font: "800 16px/1.2 var(--ff)", color: "var(--live)" }}>
                  {boletos} {boletos === 1 ? "boleto" : "boletos"}
                </span>
                <span style={{ font: "500 13px/1.4 var(--ff)", color: "var(--text-2)", display: "block", marginTop: 2 }}>
                  con tarjeta (boleto común ${URBAN_FARES.hora_stm}, 1 hora con transbordo). Valores a {FARE_VIGENCIA}.
                </span>
              </div>
            )}
            <p style={{ font: "var(--font-small)", color: "var(--text-3)", marginTop: 12 }}>
              El saldo que escribís no se guarda — es solo para esta cuenta rápida.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
