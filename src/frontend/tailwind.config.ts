import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Primary — deep teal (medical trust, not generic blue)
        primary: {
          50:  '#f0fafa',
          100: '#ccf0f0',
          200: '#99e0e0',
          300: '#5ecaca',
          400: '#2aadad',
          500: '#0d8f8f',
          600: '#0a7272', // main brand color
          700: '#095e5e',
          800: '#074a4a',
          900: '#053838',
          950: '#022424',
        },
        // Neutral — warm slate (not cold gray)
        neutral: {
          50:  '#fafaf9',
          100: '#f5f4f2',
          200: '#e8e6e1',
          300: '#d4d0c8',
          400: '#b5b0a4',
          500: '#8f8a7d',
          600: '#6b6660',
          700: '#52504a',
          800: '#3a3935',
          900: '#232220',
          950: '#141412',
        },
        // Status colors
        success: {
          50:  '#f0fdf4',
          500: '#22c55e',
          600: '#16a34a',
        },
        warning: {
          50:  '#fffbeb',
          500: '#f59e0b',
          600: '#d97706',
        },
        danger: {
          50:  '#fef2f2',
          500: '#ef4444',
          600: '#dc2626',
        },
        // Brand — pulled from the actual Alamin PolyClinic logo (gold +
        // dark brown/charcoal). Scoped to auth/marketing surfaces only —
        // the rest of the app uses the `primary` teal above. Reconciling
        // the two into one site-wide palette is a separate design decision.
        brand: {
          gold: {
            300: '#e6c98a',
            400: '#d9a54b',
            DEFAULT: '#c08a3e',
            600: '#a8722e',
            700: '#8a5c25',
          },
          charcoal: {
            DEFAULT: '#2b2118',
            700: '#3a2c1f',
            900: '#1c150f',
          },
        },
        // shadcn/ui CSS variable aliases
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        arabic: ['Thmanyah', 'Noto Sans Arabic', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // Arabic body text intentionally larger (17-18px)
        'body-ar': ['17px', { lineHeight: '1.7', letterSpacing: '0' }],
        'body-ar-lg': ['18px', { lineHeight: '1.7', letterSpacing: '0' }],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
        'card-hover': '0 4px 12px 0 rgb(0 0 0 / 0.08), 0 2px 4px -1px rgb(0 0 0 / 0.06)',
        'modal': '0 20px 60px -10px rgb(0 0 0 / 0.15)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        // Doctor Dashboard "now" line on the appointment timeline. Duration
        // is fixed at the clinic-window length in seconds; callers set
        // `--sweep-distance` (total px the line travels) and a negative
        // `animationDelay` (how far into the window "now" already is) via
        // inline style so the line starts at the correct position on mount
        // and then drifts in sync with real time — no setInterval needed.
        'timeline-sweep': {
          from: { transform: 'translateY(0px)' },
          to: { transform: 'translateY(var(--sweep-distance, 0px))' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in': 'fade-in 0.15s ease-out',
        'timeline-sweep': 'timeline-sweep 43200s linear 1 forwards',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
