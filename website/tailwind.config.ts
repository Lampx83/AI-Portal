import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#ecfdf8",
          100: "#d1faf0",
          200: "#a7f3e1",
          300: "#6ee7ce",
          400: "#34d3b4",
          500: "#10b99a",
          600: "#059682",
          700: "#04786a",
          800: "#065f56",
          900: "#064e47",
        },
      },
      fontFamily: {
        sans: ["system-ui", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
