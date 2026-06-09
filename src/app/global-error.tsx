"use client";

export default function GlobalError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es" data-theme="dark">
      <body style={{ background: "#070b14", color: "#f4f6fa", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100dvh", padding: 24, gap: 16, textAlign: "center", fontFamily: "system-ui, sans-serif" }}>
        <p style={{ fontSize: 40 }}>🚌</p>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Error crítico</h2>
        <p style={{ fontSize: 14, opacity: 0.7, maxWidth: 280, margin: 0 }}>
          La aplicación tuvo un problema. Recargá la página.
        </p>
        <button
          onClick={reset}
          style={{ marginTop: 8, padding: "10px 20px", borderRadius: 12, background: "#2563eb", color: "#fff", fontSize: 15, fontWeight: 600, border: "none", cursor: "pointer" }}
        >
          Recargar
        </button>
      </body>
    </html>
  );
}
