import { ImageResponse } from "next/og";
import { findStopServer } from "@/lib/stops-server";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Parada de transporte de Montevideo — Cuándo";

/**
 * OG dinámica por parada: al compartir /parada/3971 en WhatsApp/X/Telegram aparece
 * una tarjeta con el nombre de la parada y las líneas que paran ahí. Más share =
 * más alcance orgánico. ISR: se genera on-demand y se cachea.
 */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const stop = findStopServer(decodeURIComponent(id));
  const name = stop?.stopName ?? "Parada";
  const code = stop?.stopCode ?? decodeURIComponent(id);
  const lines = (stop?.lines ?? []).slice(0, 6);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "linear-gradient(135deg, #0d1422 0%, #070b14 60%)", padding: 72, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, color: "#f0a020", fontSize: 32, fontWeight: 800 }}>
          <div style={{ width: 22, height: 22, borderRadius: 999, border: "4px solid #eef0f5", borderRightColor: "#f0a020" }} />
          Cuándo
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 26, color: "#f0a020", fontWeight: 700, letterSpacing: 1 }}>{`PARADA ${code}`}</div>
          <div style={{ fontSize: 60, fontWeight: 800, color: "#eef0f5", letterSpacing: "-2px", marginTop: 8, lineHeight: 1.05 }}>{name}</div>
          {lines.length > 0 && (
            <div style={{ display: "flex", gap: 12, marginTop: 28, flexWrap: "wrap" }}>
              {lines.map((l) => (
                <div key={l} style={{ display: "flex", padding: "8px 18px", borderRadius: 12, background: "rgba(255,255,255,0.06)", border: "2px solid #f0a020", color: "#fff", fontSize: 30, fontWeight: 800 }}>{l}</div>
              ))}
            </div>
          )}
        </div>

        <div style={{ fontSize: 30, color: "#cdd2de" }}>Llegadas en vivo · Transporte de Montevideo</div>
      </div>
    ),
    { ...size }
  );
}
