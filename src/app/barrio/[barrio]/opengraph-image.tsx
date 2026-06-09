import { ImageResponse } from "next/og";
import { getBarrio } from "@/lib/barrios";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Bondis del barrio — Cuándo";

export default async function Image({ params }: { params: Promise<{ barrio: string }> }) {
  const { barrio } = await params;
  const b = getBarrio(barrio);
  const name = b?.name ?? "tu barrio";

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "linear-gradient(135deg, #0d1422 0%, #070b14 60%)", padding: 72, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, color: "#f0a020", fontSize: 32, fontWeight: 800 }}>
          <div style={{ width: 22, height: 22, borderRadius: 999, border: "4px solid #eef0f5", borderRightColor: "#f0a020" }} />
          Cuándo
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 26, color: "#f0a020", fontWeight: 700 }}>QUÉ LÍNEAS PASAN POR</div>
          <div style={{ fontSize: 66, fontWeight: 800, color: "#eef0f5", letterSpacing: "-2px", marginTop: 8 }}>{`Bondis en ${name}`}</div>
        </div>
        <div style={{ fontSize: 30, color: "#cdd2de" }}>Líneas, paradas y llegadas en vivo · Montevideo</div>
      </div>
    ),
    { ...size }
  );
}
