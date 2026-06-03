import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // Colores de marca Cuándo (ámbar). Los tokens reales viven en globals.css :root;
      // acá solo exponemos el accent a Tailwind por si hace falta. Se eliminaron los
      // colores LEGACY del template (brand azul ultramarino, accent naranja distinto,
      // surface) que NO son la marca y confundían — eran residuo, deuda muerta.
      colors: {
        accent: { DEFAULT: "var(--accent)", soft: "var(--accent-soft)" },
      },
      fontFamily: {
        // La fuente real es Plus Jakarta Sans (--font-jakarta), no geist (era del template).
        sans: ["var(--font-jakarta)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "bounce-soft": "bounce 2s infinite",
        "slide-up": "slideUp 0.3s ease-out",
        "fade-in": "fadeIn 0.4s ease-out",
        "ping-slow": "ping 2s cubic-bezier(0, 0, 0.2, 1) infinite",
      },
      keyframes: {
        slideUp: {
          "0%": { transform: "translateY(20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      backdropBlur: {
        xs: "2px",
      },
      screens: {
        xs: "375px",
      },
      // Radios mapeados a la escala ÚNICA de marca (globals.css :root). Así los
      // `rounded-lg/xl/2xl` que usan los componentes apuntan a los tokens de Cuándo
      // en vez de a 3 valores casi iguales → coherencia visual sin tocar 58 sitios.
      borderRadius: {
        md: "var(--r-chip)",    // 10px
        lg: "var(--r-chip)",    // 10px (chips, inputs)
        xl: "var(--r-card)",    // 14px (tarjetas, botones)
        "2xl": "var(--r-card)", // 14px (unificado con xl — eran casi iguales)
        "3xl": "var(--r-lg)",   // 18px (sheets)
        full: "var(--r-pill)",
      },
    },
  },
  plugins: [],
};

export default config;
