/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./app/**/*.{js,jsx}",
    "./src/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    screens: {
      sm: "768px",
      lg: "1024px",
      xl: "1200px",
      "2xl": "1400px",
    },
    extend: {
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        /* shadcn standard tokens (HSL-based) */
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
        "muted-foreground": "hsl(var(--muted-foreground))",
        "accent-foreground": "hsl(var(--accent-foreground))",
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        /* App-specific tokens (hex-based) */
        accent: {
          DEFAULT: "var(--color-accent)",
          light: "var(--color-accent-light)",
          hover: "var(--color-accent-hover)",
        },
        text: "var(--color-text)",
        muted: "var(--color-muted)",
        success: {
          DEFAULT: "var(--color-success)",
          light: "var(--color-success-light)",
        },
        error: {
          DEFAULT: "var(--color-error)",
          light: "var(--color-error-light)",
        },
        border: "var(--color-border)",
        "input-bg": "var(--color-input-bg)",
        overlay: "var(--color-overlay)",
        quiz: {
          DEFAULT: "var(--color-quiz)",
          light: "var(--color-quiz-light)",
          hover: "var(--color-quiz-hover)",
        },
        "unit-quiz": {
          DEFAULT: "var(--color-unit-quiz)",
          light: "var(--color-unit-quiz-light)",
        },
        amber: {
          DEFAULT: "var(--color-amber)",
          light: "var(--color-amber-light)",
          dark: "var(--color-amber-dark)",
        },
        carolina: {
          bg: "var(--color-carolina-bg)",
          primary: "var(--color-carolina-primary)",
          "primary-dark": "var(--color-carolina-primary-dark)",
          "active-bg": "var(--color-carolina-active-bg)",
          "active-border": "var(--color-carolina-active-border)",
          "bubble-border": "var(--color-carolina-bubble-border)",
          "error-text": "var(--color-carolina-error-text)",
          "correction-text": "var(--color-carolina-correction-text)",
          "pill-bg": "var(--color-carolina-pill-bg)",
          "pill-text": "var(--color-carolina-pill-text)",
          "input-bg": "var(--color-carolina-input-bg)",
          timestamp: "var(--color-carolina-timestamp)",
        },
        sidebar: {
          "active-bg": "var(--color-sidebar-active-bg)",
          "active-text": "var(--color-sidebar-active-text)",
          "active-icon": "var(--color-sidebar-active-icon)",
          star: "var(--color-sidebar-star)",
        },
      },
      fontFamily: {
        nunito: ["'Nunito'", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
      },
      maxWidth: {
        app: "520px",
        "app-sm": "700px",
        "app-xl": "860px",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0", transform: "translateY(14px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        slideInRight: {
          from: { opacity: "0", transform: "translateX(40px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        slideInLeft: {
          from: { opacity: "0", transform: "translateX(-40px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        countUp: {
          from: { opacity: "0", transform: "scale(0.8)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          from: { backgroundPosition: "-600px 0" },
          to: { backgroundPosition: "600px 0" },
        },
        skeletonGlow: {
          "0%, 100%": {
            boxShadow: "0 0 8px rgba(0,180,160,0.08), 0 1px 4px rgba(0,60,50,0.06)",
          },
          "50%": {
            boxShadow: "0 0 20px rgba(0,180,160,0.18), 0 4px 12px rgba(0,60,50,0.08)",
          },
        },
        confettiDrop: {
          "0%": { transform: "translateY(-10vh) rotate(0deg)", opacity: "1" },
          "80%": { opacity: "1" },
          "100%": { transform: "translateY(105vh) rotate(720deg)", opacity: "0" },
        },
        sheetUp: {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
        overlayFade: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        progressGrow: {
          from: { width: "0%" },
        },
        progressIndeterminate: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(250%)" },
        },
        scoreReveal: {
          from: { strokeDashoffset: "339.292" },
        },
        syncPulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
        syncSpin: {
          to: { transform: "rotate(360deg)" },
        },
        carolinaDots: {
          "0%, 20%": { opacity: "0.2" },
          "50%": { opacity: "1" },
          "80%, 100%": { opacity: "0.2" },
        },
        gpdfFadeUp: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        gpdfSpin: {
          to: { transform: "rotate(360deg)" },
        },
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease-out both",
        "slide-in-right": "slideInRight 0.3s ease-out both",
        "slide-in-left": "slideInLeft 0.3s ease-out both",
        "slide-up": "slideUp 0.3s ease-out both",
        "score-anim": "countUp 0.6s 0.5s ease-out both",
        shimmer: "shimmer 1.8s infinite ease-in-out",
        "skeleton-glow": "skeletonGlow 2s infinite ease-in-out",
        "confetti-drop": "confettiDrop var(--confetti-dur, 3s) var(--confetti-delay, 0s) ease-in forwards",
        "sheet-up": "sheetUp 0.3s ease-out",
        "overlay-fade": "overlayFade 0.2s ease-out",
        "progress-indeterminate": "progressIndeterminate 1.5s ease-in-out infinite",
        "sync-pulse": "syncPulse 2s infinite",
        "sync-spin": "syncSpin 1s linear infinite",
        "carolina-dots": "carolinaDots 1.4s infinite both",
        "gpdf-fade-up": "gpdfFadeUp 0.25s ease-out both",
        "gpdf-spin": "gpdfSpin 1s linear infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
