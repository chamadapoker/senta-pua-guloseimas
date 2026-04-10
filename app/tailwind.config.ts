import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        azul: '#1a3a6b',
        'azul-claro': '#2456a4',
        vermelho: '#c0392b',
        'vermelho-escuro': '#922020',
        dourado: '#d4a843',
        'dourado-claro': '#f0d68a',
        fundo: '#0f1117',
        'fundo-card': '#1a1d28',
        'fundo-elevado': '#242837',
        texto: '#e8e8ed',
        'texto-fraco': '#8a8d9b',
        borda: '#2a2e3d',
      },
      fontFamily: {
        display: ['"Bebas Neue"', 'Impact', 'sans-serif'],
        body: ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(12px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        glow: { '0%': { boxShadow: '0 0 5px rgba(192,57,43,0.3)' }, '100%': { boxShadow: '0 0 20px rgba(192,57,43,0.6)' } },
      },
    },
  },
  plugins: [],
} satisfies Config;
