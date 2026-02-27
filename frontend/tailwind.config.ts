import type { Config } from "tailwindcss"
import typography from "@tailwindcss/typography"

const config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],

  /**
   * 🔑 BẮT BUỘC cho colorPalettes
   */
  safelist: [
    // blue
    "bg-blue-100", "dark:bg-blue-900/30", "text-blue-600", "dark:text-blue-400",
    // cyan
    "bg-cyan-100", "dark:bg-cyan-900/30", "text-cyan-600", "dark:text-cyan-400",
    // purple
    "bg-purple-100", "dark:bg-purple-900/30", "text-purple-600", "dark:text-purple-400",
    // pink
    "bg-pink-100", "dark:bg-pink-900/30", "text-pink-600", "dark:text-pink-400",
    // indigo
    "bg-indigo-100", "dark:bg-indigo-900/30", "text-indigo-600", "dark:text-indigo-400",
    // emerald
    "bg-emerald-100", "dark:bg-emerald-900/30", "text-emerald-600", "dark:text-emerald-400",
    // amber
    "bg-amber-100", "dark:bg-amber-900/30", "text-amber-600", "dark:text-amber-400",
    // orange
    "bg-orange-100", "dark:bg-orange-900/30", "text-orange-600", "dark:text-orange-400",
    // teal
    "bg-teal-100", "dark:bg-teal-900/30", "text-teal-600", "dark:text-teal-400",
    // rose
    "bg-rose-100", "dark:bg-rose-900/30", "text-rose-600", "dark:text-rose-400",
    // violet
    "bg-violet-100", "dark:bg-violet-900/30", "text-violet-600", "dark:text-violet-400",
    // sky
    "bg-sky-100", "dark:bg-sky-900/30", "text-sky-600", "dark:text-sky-400",
  ],

  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        brand: "var(--brand)",
        "neu-blue": "#0061bb",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "transparent",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: "100%",
          },
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate"), typography],
} satisfies Config

export default config
