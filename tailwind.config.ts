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
        // Brand — neon teal (Leonardo-style primary accent)
        brand: {
          DEFAULT: "#00E5B4",   // neon teal — CTAs, active states, OPTIMAL
          light:   "#33ECC3",   // lighter teal for hover highlights
          dark:    "#00B891",   // darker teal for pressed/hover-dark states
        },
        // App backgrounds — dark navy palette
        surface: {
          base:    "#070E17",   // deepest background (near-black navy)
          raised:  "#0E1B28",   // cards, sheets
          overlay: "#162436",   // modals, elevated surfaces
          border:  "#1E3347",   // dividers, card borders
        },
        // Vehicle status
        status: {
          optimal:    "#00E5B4",   // teal — matches brand (OPTIMAL = healthy)
          serviceDue: "#F59E0B",   // amber
          fault:      "#EF4444",   // red
        },
        // Job stage progress dots
        stage: {
          inactive: "#1E3347",
          active:   "#00E5B4",
          complete: "#00E5B4",
        },
        // Text hierarchy
        text: {
          primary:   "#FFFFFF",
          secondary: "#8FA3B0",   // muted blue-gray
          muted:     "#4A6070",   // very muted, placeholders
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: {
        xl:    "1rem",
        "2xl": "1.25rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        card:        "0 4px 24px rgba(0, 0, 0, 0.5)",
        glow:        "0 0 20px rgba(0, 229, 180, 0.28)",
        "glow-sm":   "0 0 10px rgba(0, 229, 180, 0.18)",
        "glow-lg":   "0 0 40px rgba(0, 229, 180, 0.45)",
        "inner-glow": "inset 0 0 20px rgba(0, 229, 180, 0.06)",
      },
      // Animation utilities
      animation: {
        "fade-in":        "fadeIn 0.25s ease-out both",
        "fade-up":        "fadeUp 0.3s ease-out both",
        "shimmer":        "shimmer 1.5s linear infinite",
        "glow-pulse":     "glowPulse 2.5s ease-in-out infinite",
        // BrandMark: inner glow breathes in/out
        "breathe-glow":   "breatheGlow 4s ease-in-out infinite",
        // BrandMark: slow light beam sweeps across the gauge face
        "gauge-sweep":    "gaugeSweep 10s linear 2s infinite",
        // Onboarding: directional slide transitions
        "slide-in-right": "slideInRight 0.35s ease-out both",
        "slide-in-left":  "slideInLeft 0.35s ease-out both",
        // Onboarding step 2: SVG route line draws itself
        "route-draw":     "routeDraw 1.4s ease-out 0.3s both",
        // Onboarding step 3: radar dish sweep
        "radar-sweep":    "radarSweep 2.8s linear infinite",
      },
      keyframes: {
        fadeIn: {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        fadeUp: {
          "0%":   { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        glowPulse: {
          "0%, 100%": { boxShadow: "0 0 8px rgba(0, 229, 180, 0.15)" },
          "50%":      { boxShadow: "0 0 28px rgba(0, 229, 180, 0.5)" },
        },
        // Glow div opacity pulse — creates "breathing" radiance
        breatheGlow: {
          "0%, 100%": { opacity: "1" },
          "50%":      { opacity: "0.45" },
        },
        // Light beam sweeps left→right; pauses invisibly for most of the cycle
        gaugeSweep: {
          "0%":   { transform: "translateX(-160%)", opacity: "0" },
          "5%":   { transform: "translateX(-160%)", opacity: "0" },
          "10%":  { transform: "translateX(-160%)", opacity: "1" },
          "30%":  { transform: "translateX(260%)",  opacity: "1" },
          "35%":  { transform: "translateX(260%)",  opacity: "0" },
          "100%": { transform: "translateX(260%)",  opacity: "0" },
        },
        // Onboarding: slide in from right (Next)
        slideInRight: {
          "0%":   { opacity: "0", transform: "translateX(28px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        // Onboarding: slide in from left (Back)
        slideInLeft: {
          "0%":   { opacity: "0", transform: "translateX(-28px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        // Onboarding step 2: SVG path stroke-dashoffset draw-on
        routeDraw: {
          "0%":   { strokeDashoffset: "160" },
          "100%": { strokeDashoffset: "0" },
        },
        // Onboarding step 3: rotating radar conic sweep
        radarSweep: {
          "0%":   { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
      },
      screens: {
        // Mobile-first; xl+ for admin panel
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
