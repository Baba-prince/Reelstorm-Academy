/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        void: "#080808",
        deep: "#0A0A0A",
        panel: "#101010",
        elevated: "#151515",
        violet: {
          DEFAULT: "#7C3AED",
          soft: "#C4B5FD",
        },
        cyan: {
          DEFAULT: "#00D9FF",
        },
        orange: {
          DEFAULT: "#FF7A00",
          soft: "#FFB86A",
        },
        chrome: "#E5E7EB",
      },
      fontFamily: {
        display: ["var(--font-montserrat)", "Inter", "system-ui", "sans-serif"],
        body: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      borderRadius: {
        rs: "16px",
        "rs-xl": "24px",
      },
      spacing: {
        grid: "72px",
      },
      backgroundImage: {
        signature: "linear-gradient(90deg, #0A0A0A 0%, #7C3AED 50%, #00D9FF 100%)",
        storm: "linear-gradient(135deg, #7C3AED 0%, #00D9FF 100%)",
        empire: "linear-gradient(90deg, #FF7A00 0%, #FFB86A 100%)",
      },
    },
  },
  plugins: [],
};
