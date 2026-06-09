import { ImageResponse } from "next/og";
import { getDestino, aDest } from "@/lib/destinos";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Cómo llegar en ómnibus — Cuándo";

/** OG dinámica por destino: compartir "/a/tres-cruces" muestra una tarjeta linda. */
export default async function Image({ params }: { params: Promise<{ destino: string }> }) {
  const { destino } = await params;
  const d = getDestino(destino);
  const titulo = d ? `¿Cómo llegar ${aDest(d.name)}?` : "¿Cómo llegar en ómnibus?";

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "linear-gradient(135deg, #0d1422 0%, #070b14 60%)", padding: 72, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, color: "#f0a020", fontSize: 32, fontWeight: 800 }}>
          <div style={{ width: 22, height: 22, borderRadius: 999, border: "4px solid #eef0f5", borderRightColor: "#f0a020" }} />
          Cuándo
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 26, color: "#f0a020", fontWeight: 700 }}>CÓMO LLEGAR EN ÓMNIBUS</div>
          <div style={{ fontSize: 62, fontWeight: 800, color: "#eef0f5", letterSpacing: "-2px", marginTop: 10, lineHeight: 1.05 }}>{titulo}</div>
        </div>
        <div style={{ fontSize: 30, color: "#cdd2de" }}>Qué bus tomar · llegadas en vivo · Montevideo</div>
      </div>
    ),
    { ...size }
  );
}
