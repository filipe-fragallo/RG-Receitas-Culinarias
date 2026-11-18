import type { Config } from 'tailwindcss';
import forms from '@tailwindcss/forms';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        olive: {
          50: '#f6f7f1',
          100: '#e9ecdf',
          200: '#d5dac4',
          300: '#b8c09e',
          400: '#99a476',
          500: '#7d895a',
          600: '#626d44',
          700: '#4c5537',
          800: '#3e4530',
          900: '#363c2b',
          950: '#1c2016',
        },
        cream: {
          50: '#fdfbf6',
          100: '#faf6ec',
          200: '#f3ecd9',
          300: '#e9dec2',
          400: '#dccba4',
        },
        terracotta: {
          50: '#fbf3ee',
          100: '#f6e4d9',
          200: '#ecc7b3',
          300: '#dfa284',
          400: '#d07c56',
          500: '#c05f38',
          600: '#a94a2d',
          700: '#8d3a27',
          800: '#733125',
          900: '#5f2b22',
        },
        ink: {
          DEFAULT: '#24281f',
          soft: '#4f5548',
          muted: '#747a6b',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'Cambria', 'serif'],
      },
      boxShadow: {
        soft: '0 18px 50px -24px rgba(36, 40, 31, 0.35)',
        lift: '0 24px 60px -28px rgba(36, 40, 31, 0.45)',
        card: '0 2px 8px -2px rgba(36, 40, 31, 0.08), 0 12px 28px -20px rgba(36, 40, 31, 0.18)',
      },
      backgroundImage: {
        'paper-glow':
          'radial-gradient(ellipse at 12% 0%, rgba(220, 203, 164, 0.45), transparent 55%), radial-gradient(ellipse at 95% 18%, rgba(184, 192, 158, 0.35), transparent 45%)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'toast-in': {
          '0%': { opacity: '0', transform: 'translateY(-8px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 420ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-in': 'fade-in 240ms ease-out both',
        'toast-in': 'toast-in 220ms cubic-bezier(0.22, 1, 0.36, 1) both',
      },
    },
  },
  plugins: [forms({ strategy: 'class' })],
} satisfies Config;
