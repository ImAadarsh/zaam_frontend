import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./src/app/**/*.{ts,tsx}', './src/components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        zaam: {
          50: '#FCF9F0',
          100: '#F7F0D6',
          200: '#EFE0AD',
          300: '#E6CF83',
          400: '#DEBF5A',
          500: '#D4A017', // Base
          600: '#AA8012',
          700: '#80600E',
          800: '#554009',
          900: '#2B2005',
          950: '#151002',
          // Legacy support
          gold: '#D4A017',
          black: '#0A0A0A',
          white: '#FFFFFF',
          charcoal: '#1E1E1E',
          grey: '#6B6B6B',
          soft: '#E5E5E5'
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
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
      backgroundImage: {
        'gold-radial': 'radial-gradient(closest-side, #D4A017, rgba(212,160,23,0))',
        'gold-linear': 'linear-gradient(135deg, #D4A017 0%, #B88914 100%)',
        'glass-gradient': 'linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)'
      },
      borderRadius: {
        card: '16px',
        xl: '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem'
      },
      boxShadow: {
        card: '0 4px 20px -2px rgba(0,0,0,0.05)',
        'elev-1': '0 2px 4px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)',
        'elev-2': '0 8px 24px -4px rgba(0,0,0,0.08)',
        'elev-3': '0 20px 40px -8px rgba(0,0,0,0.12)',
        'glow': '0 0 20px rgba(212, 160, 23, 0.15)'
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'sans-serif'],
        heading: ['var(--font-poppins)', 'sans-serif'],
      },
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(.22,.61,.36,1)'
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' }
        },
        'slide-in-right': {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' }
        }
      },
      animation: {
        'fade-in': 'fade-in 400ms var(--ease, cubic-bezier(.22,.61,.36,1)) both',
        'scale-in': 'scale-in 300ms var(--ease, cubic-bezier(.22,.61,.36,1)) both',
        'slide-in': 'slide-in-right 300ms var(--ease, cubic-bezier(.22,.61,.36,1)) both'
      }
    }
  },
  plugins: []
};
export default config;

