import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  safelist: [
    // Add any complex class patterns that Tailwind might purge
    // Cubic bezier and other complex animations (with escaped brackets)
    'after:ease-&lsqb;cubic-bezier(0.34,1.56,0.64,1)&rsqb;',
    'before:ease-&lsqb;cubic-bezier(0.34,1.56,0.64,1)&rsqb;',
    'ease-&lsqb;cubic-bezier(0.34,1.56,0.64,1)&rsqb;',
    // Add other specific complex classes that might be purged
    'after:transition-all',
    'before:transition-all',
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        'DEFAULT': '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)',
        'md': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
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
        "scoreCircleFill": {
          "0%": { 
            strokeDasharray: "0, 100"
          },
          "100%": { 
            strokeDasharray: "var(--score-target), 100"
          }
        },
        "countUp": {
          "0%": { content: "'0'" },
          "20%": { content: "attr(data-target)" },
          "40%": { content: "attr(data-target)" },
          "60%": { content: "attr(data-target)" },
          "80%": { content: "attr(data-target)" },
          "100%": { content: "attr(data-target)" }
        },
        "colorTransition": {
          "0%": { stroke: "#ef4444" },  
          "50%": { stroke: "#eab308" },
          "100%": { stroke: "#22c55e" }
        }
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "scoreCircle": "scoreCircleFill 2.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards, colorTransition 2.5s ease-out forwards",
        "countUp": "countUp 2s steps(5, end) forwards"
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;