import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "SF Mono", "Menlo", "Monaco", "Consolas", "monospace"],
      },
      colors: {
        background: "#000000",
        surface: "#0A0A0A",
        "surface-elevated": "#111111",
        "text-primary": "#F4F4F5",
        "text-secondary": "#A1A1AA",
        "text-tertiary": "#71717A",
        border: "rgba(255, 255, 255, 0.08)",
        "border-hover": "rgba(255, 255, 255, 0.15)",
        accent: {
          purple: "#5E6AD2",
          neon: "#E5FF52",
        },
        zinc: {
          925: "#0a0a0c",
        },
      },
      backgroundImage: {
        "hero-glow": "radial-gradient(ellipse 80% 80% at 50% -20%, rgba(94,106,210,0.12), transparent)",
      },
      spacing: {
        "section": "8rem",
      },
    },
  },
  plugins: [],
};

export default config;
