import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        azul: '#1d3fa0',
        'azul-claro': '#2b52c4',
        vermelho: '#d42b2b',
        dourado: '#d4a843',
        verde: '#16a34a',
        'verde-escuro': '#15803d',
        fundo: '#eef1f5',
        'fundo-card': '#ffffff',
        'fundo-elevado': '#f5f7fa',
        texto: '#1a1a1a',
        'texto-fraco': '#6b7280',
        borda: '#e2e5eb',
      },
      fontFamily: {
        display: ['"Bebas Neue"', 'Impact', 'sans-serif'],
        body: ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(12px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
} satisfies Config;
