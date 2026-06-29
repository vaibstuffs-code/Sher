/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        base: {
          DEFAULT: "#0B0E14", // not-quite-black, slightly blue
          raised: "#11151D",
          panel: "#161B26",
          border: "#222937",
        },
        accent: {
          indigo: "#6E5BFF",
          "indigo-dim": "#453B99",
          cyan: "#3DD9E8",
          coral: "#FF5C7A",
          amber: "#FFC857",
        },
        text: {
          primary: "#E7EAF0",
          secondary: "#8E96A8",
          tertiary: "#5C6478",
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
        sans: ["Inter", "ui-sans-serif", "system-ui"],
        display: ["Space Grotesk", "Inter", "sans-serif"],
      },
      boxShadow: {
        glow_indigo: "0 0 24px rgba(110, 91, 255, 0.25)",
        glow_cyan: "0 0 24px rgba(61, 217, 232, 0.25)",
        glow_coral: "0 0 24px rgba(255, 92, 122, 0.25)",
      },
      animation: {
        pulse_slow: "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [],
};
