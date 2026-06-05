import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],

  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],

  theme: {
    extend: {
      colors: {
        // ── Handla brand: gold/amber accent ────────────────────────────────
        gold: {
          50:  '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',   // main accent
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        // ── Dark surfaces ──────────────────────────────────────────────────
        dark: {
          900: '#0a0a0a',   // page background
          800: '#111111',
          750: '#141414',
          700: '#181818',
          600: '#1e1e1e',   // card background
          500: '#252525',   // card hover
          400: '#2e2e2e',   // borders
          300: '#3a3a3a',
          200: '#4a4a4a',
          100: '#666666',
        },
        // ── Keep electric/violet/cyan for utility ──────────────────────────
        electric: {
          400: '#52c3ff',
          500: '#29a8ff',
        },
        violet: {
          400: '#a78bfa',
          500: '#8b5cf6',
        },
        cyan: {
          400: '#22d3ee',
          500: '#06b6d4',
        },
        // ── shadcn/ui CSS-variable tokens ──────────────────────────────────
        border:      'hsl(var(--border))',
        input:       'hsl(var(--input))',
        ring:        'hsl(var(--ring))',
        background:  'hsl(var(--background))',
        foreground:  'hsl(var(--foreground))',
        primary: {
          DEFAULT:    'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT:    'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT:    'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT:    'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT:    'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT:    'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT:    'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },

      fontFamily: {
        sans: ['var(--font-space-grotesk)', 'Space Grotesk', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },

      boxShadow: {
        'glow-gold':   '0 0 20px rgba(251,191,36,0.3), 0 0 60px rgba(251,191,36,0.10)',
        'glow-gold-lg':'0 0 40px rgba(251,191,36,0.5), 0 0 80px rgba(251,191,36,0.15)',
        'card':        '0 1px 3px rgba(0,0,0,0.5), 0 4px 24px rgba(0,0,0,0.4)',
        'card-hover':  '0 4px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(251,191,36,0.2)',
        'glass':       '0 8px 32px rgba(0, 0, 0, 0.5)',
        'glass-lg':    '0 20px 60px rgba(0, 0, 0, 0.6)',
        // legacy aliases
        'glow-blue':   '0 0 20px rgba(41,168,255,0.35)',
        'glow-violet': '0 0 20px rgba(139,92,246,0.35)',
        'glow-cyan':   '0 0 20px rgba(6,182,212,0.35)',
      },

      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':  'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'grid-pattern':    'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
      },

      animation: {
        'fade-in':    'fade-in 0.5s ease-out forwards',
        'fade-up':    'fade-up 0.6s ease-out forwards',
        'float':      'float 6s ease-in-out infinite',
        'pulse-gold': 'pulse-gold 3s ease-in-out infinite',
        'marquee':    'marquee 30s linear infinite',
        'shimmer':    'shimmer 2s linear infinite',
        'spin-slow':  'spin 8s linear infinite',
      },

      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-10px)' },
        },
        'pulse-gold': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(251,191,36,0.2)' },
          '50%':      { boxShadow: '0 0 40px rgba(251,191,36,0.5)' },
        },
        marquee: {
          from: { transform: 'translateX(0%)' },
          to:   { transform: 'translateX(-50%)' },
        },
        shimmer: {
          from: { backgroundPosition: '-200% 0' },
          to:   { backgroundPosition: '200% 0' },
        },
      },

      borderRadius: {
        lg:   'var(--radius)',
        md:   'calc(var(--radius) - 2px)',
        sm:   'calc(var(--radius) - 4px)',
        '4xl': '2rem',
      },
    },
  },

  plugins: [
    require('@tailwindcss/typography'),
    require('@tailwindcss/forms'),
  ],
};

export default config;
