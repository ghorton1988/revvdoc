import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Brand
        brand: {
          DEFAULT: "#D4A843",   // gold — primary accent from designs
          light:   "#E8C567",
          dark:    "#A8832F",
        },
        // App backgrounds (dark-first)
        surface: {
          base:    "#0A0A0A",   // deepest background
          raised:  "#141414",   // cards, sheets
          overlay: "#1E1E1E",   // modals, popovers
          border:  "#2A2A2A",   // dividers
        },
        // Vehicle status
        status: {
          optimal:     "#22C55E",   // green
          serviceDue:  "#F59E0B",   // amber
          fault:       "#EF4444",   // red
        },
        // Job stage progress
        stage: {
          inactive: "#3A3A3A",
          active:   "#D4A843",
          complete: "#22C55E",
        },
        // Text
        text: {
          primary:   "#FFFFFF",
          secondary: "#A0A0A0",
          muted:     "#606060",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: {
        xl:  "1rem",
        "2xl": "1.25rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        card: "0 4px 24px rgba(0, 0, 0, 0.4)",
        glow: "0 0 20px rgba(212, 168, 67, 0.3)",
      },
      screens: {
        // Mobile-first breakpoints; xl+ used only for admin panel
        xs: "375px",
        sm: "430px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
      },
    },
  },
  plugins: [],
};

export default config;
