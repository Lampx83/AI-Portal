import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

const config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
    "*.{js,ts,jsx,tsx,mdx}",
  ],
  prefix: "",
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
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },

      /**
       * Tối ưu typography cho Markdown / README
       */
      typography: {
        DEFAULT: {
          css: {
            maxWidth: "100%",

            /* Inline code */
            code: {
              color: "hsl(var(--foreground))",
              backgroundColor: "hsl(var(--muted))",
              padding: "0.2rem 0.4rem",
              borderRadius: "0.375rem",
              fontWeight: "500",
            },

            /* Bỏ dấu backtick mặc định */
            "code::before": { content: '""' },
            "code::after": { content: '""' },

            /* Code block */
            pre: {
              backgroundColor: "hsl(220 13% 18%)", // nền đậm
              color: "hsl(210 40% 96%)", // chữ sáng
              padding: "1rem",
              borderRadius: "0.5rem",
              fontSize: "0.875rem",
              lineHeight: "1.6",
              overflowX: "auto",
            },

            /* Syntax highlight */
            "pre code": {
              backgroundColor: "transparent",
              padding: "0",
              color: "inherit",
              fontWeight: "400",
            },
          },
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate"), typography],
} satisfies Config;

export default config;
