import { ImageResponse } from "next/og";
import { getLineHeadsigns } from "@/lib/gtfs-db";

export const dynamic = "force-static";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Línea de transporte de Montevideo — Cuándo";

/**
 * Imagen Open Graph DINÁMICA por línea. Cuando alguien comparte /linea/121 en WhatsApp,
 * X, Telegram, etc., en vez de una preview genérica aparece una tarjeta linda con el
 * número de línea, sus destinos y la marca → crecimiento orgánico (la gente comparte
 * lo que se ve bien). 1200×630 = estándar OG/Twitter large card.
 */
export default async function Image({ params }: { params: Promise<{ linea: string }> }) {
  const { linea } = await params;
  const line = decodeURIComponent(linea);
  const headsigns = (() => { try { return getLineHeadsigns(line); } catch { return []; } })();
  const dests = headsigns.slice(0, 2).join("  ·  ");

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "linear-gradient(135deg, #0d1422 0%, #070b14 60%)", padding: 72, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, color: "#f0a020", fontSize: 32, fontWeight: 800 }}>
          <div style={{ width: 22, height: 22, borderRadius: 999, border: "4px solid #eef0f5", borderRightColor: "#f0a020" }} />
          Cuándo
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
          <div style={{ display: "flex", width: 180, height: 180, borderRadius: 36, background: "rgba(255,255,255,0.06)", border: "5px solid #f0a020", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 84, fontWeight: 800 }}>{line}</div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 64, fontWeight: 800, color: "#eef0f5", letterSpacing: "-2px" }}>{`Línea ${line}`}</div>
            {dests && <div style={{ fontSize: 32, color: "#9aa3b5", marginTop: 8 }}>{dests}</div>}
          </div>
        </div>

        <div style={{ fontSize: 30, color: "#cdd2de" }}>Recorrido y llegadas en vivo · Transporte de Montevideo</div>
      </div>
    ),
    { ...size }
  );
}
