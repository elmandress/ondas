"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => { console.error(error); }, [error]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100dvh", padding: 24, gap: 16, textAlign: "center" }}>
      <p style={{ fontSize: 40 }}>🚌</p>
      <h2 style={{ font: "700 20px/1.2 var(--ff)", color: "var(--text)", margin: 0 }}>Algo salió mal</h2>
      <p style={{ font: "var(--font-small)", color: "var(--text-2)", maxWidth: 280, margin: 0 }}>
        El bondi tuvo un problema técnico. Intentá de nuevo.
      </p>
      <button
        onClick={reset}
        style={{ marginTop: 8, padding: "10px 20px", borderRadius: 12, background: "var(--accent)", color: "#fff", font: "600 15px/1 var(--ff)", border: "none", cursor: "pointer" }}
      >
        Reintentar
      </button>
    </div>
  );
}
