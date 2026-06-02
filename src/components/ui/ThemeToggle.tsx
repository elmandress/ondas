"use client";

import { useEffect, useState } from "react";
import { useTheme, toggleTheme, getTheme, applyTheme } from "@/lib/theme";

/**
 * Botón sol/luna para alternar tema. El oscuro es el default y la base de marca;
 * esto solo permite cambiar (o seguir al dispositivo si nunca se tocó).
 */
export default function ThemeToggle({ size = 40 }: { size?: number }) {
  const theme = useTheme();
  const [mounted, setMounted] = useState(false);
  // Aplica el tema en el primer render del cliente (por si vino de system pref).
  useEffect(() => {
    applyTheme(getTheme());
    setMounted(true);
  }, []);

  if (!mounted) return <span style={{ width: size, height: size, display: "inline-block" }} aria-hidden />;
  const dark = theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      aria-label={dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      className="icon-btn sm"
      style={{ width: size, height: size, color: "var(--text-2)" }}
      title={dark ? "Modo claro" : "Modo oscuro"}
    >
      {dark ? (
        // Sol (tocar = ir a claro)
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        // Luna (tocar = ir a oscuro)
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  );
}
