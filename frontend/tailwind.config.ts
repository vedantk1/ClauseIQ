import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        heading: ["Space Grotesk", "sans-serif"],
      },
      colors: {
        // Dark-first color system from design spec
        bg: {
          primary: "#0E0E11",
          surface: "#18181D",
          elevated: "#1F1F25",
        },
        accent: {
          purple: "#7C3AED",
          green: "#10B981",
          amber: "#F59E0B",
          rose: "#EF4444",
        },
        text: {
          primary: "#F9FAFB",
          secondary: "#D1D5DB",
        },
        border: {
          muted: "#2A2A31",
        },
        // Keep some Tailwind defaults for light mode (future)
        gray: {
          50: "#F9FAFB",
          100: "#F3F4F6",
          200: "#E5E7EB",
          300: "#D1D5DB",
          400: "#9CA3AF",
          500: "#6B7280",
          600: "#4B5563",
          700: "#374151",
          800: "#1F2937",
          900: "#111827",
          950: "#030712",
        },
      },
      spacing: {
        // 8pt grid system
        "18": "4.5rem", // 72px
        "22": "5.5rem", // 88px
      },
      maxWidth: {
        "8xl": "88rem",
        "9xl": "96rem",
      },
      fontSize: {
        // Typography scale from spec
        "heading-lg": ["2rem", { lineHeight: "1.25", fontWeight: "600" }], // 32px
        "heading-md": ["1.5rem", { lineHeight: "1.25", fontWeight: "600" }], // 24px
        "heading-sm": ["1.25rem", { lineHeight: "1.25", fontWeight: "600" }], // 20px
        "body-lg": ["1.0625rem", { lineHeight: "1.45" }], // 17px
        body: ["1rem", { lineHeight: "1.45" }], // 16px
        "body-sm": ["0.875rem", { lineHeight: "1.45" }], // 14px
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-out",
        "slide-up": "slideUp 0.2s ease-out",
        shimmer: "shimmer 1.4s linear infinite",
        press: "press 0.1s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0.2" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(16px)", opacity: "0.2" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        press: {
          "0%": { transform: "translateY(0) scale(1)" },
          "100%": { transform: "translateY(2px) scale(0.98)" },
        },
      },
      boxShadow: {
        card: "0 1px 3px 0 rgba(0, 0, 0, 0.3), 0 1px 2px 0 rgba(0, 0, 0, 0.2)",
        "card-lg":
          "0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)",
      },
    },
  },
  plugins: [],
};

export default config;
