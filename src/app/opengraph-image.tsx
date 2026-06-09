import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Cuándo — El bondi te espera. Vos no.";

/**
 * OG image de la HOME — la URL más compartida (cuando.uy). Sin esto, mandar el link por
 * WhatsApp mostraba solo texto. Con esto aparece una tarjeta de marca → más clics, más
 * instalaciones. Next reusa esta imagen también para Twitter si no hay twitter-image.
 */
export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "linear-gradient(135deg, #0d1422 0%, #070b14 55%)", padding: 80, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, color: "#f0a020", fontSize: 38, fontWeight: 800 }}>
          <div style={{ width: 30, height: 30, borderRadius: 999, border: "5px solid #eef0f5", borderRightColor: "#f0a020" }} />
          Cuándo
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 80, fontWeight: 800, color: "#eef0f5", letterSpacing: "-3px", lineHeight: 1.02 }}>El bondi te espera.</div>
          <div style={{ fontSize: 80, fontWeight: 800, color: "#f0a020", letterSpacing: "-3px", lineHeight: 1.02 }}>Vos no.</div>
        </div>

        <div style={{ fontSize: 32, color: "#cdd2de" }}>Llegadas en vivo, rutas inteligentes y mapa en tiempo real · Montevideo</div>
      </div>
    ),
    { ...size }
  );
}
