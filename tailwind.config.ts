import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand primario - azul ultramarino vibrante
        brand: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
          950: "#172554",
        },
        // Accent - naranja cálido para alertas y tiempos
        accent: {
          50: "#fff7ed",
          100: "#ffedd5",
          200: "#fed7aa",
          300: "#fdba74",
          400: "#fb923c",
          500: "#f97316",
          600: "#ea580c",
          700: "#c2410c",
        },
        // Verde éxito - bus llegando
        arrive: {
          400: "#4ade80",
          500: "#22c55e",
          600: "#16a34a",
        },
        // Superficie - fondo oscuro moderno
        surface: {
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          800: "#1e293b",
          850: "#172032",
          900: "#0f172a",
          950: "#080d1a",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
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
