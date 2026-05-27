/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
        mono: ["SF Mono", "Menlo", "Monaco", "Consolas", "monospace"],
      },
      colors: {
        zinc: {
          925: "#0a0a0c",
        },
      },
      backgroundImage: {
        "hero-glow": "radial-gradient(ellipse 80% 80% at 50% -20%, rgba(59,130,246,0.08), transparent)",
        "card-glow": "radial-gradient(ellipse 100% 100% at 50% 0%, rgba(255,255,255,0.03), transparent)",
      },
    },
  },
  plugins: [],
};
