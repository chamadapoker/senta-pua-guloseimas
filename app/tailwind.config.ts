import type { Config } from 'tailwindcss';
import { carregarEsquadrao } from './esquadroes/carregar';

// Paleta do brasão vem do esquadrão escolhido no build (VITE_ESQUADRAO, padrão "senta-pua")
const { cores } = carregarEsquadrao();

/** "#0d1640" -> "13, 22, 64" (para rgba nas sombras) */
const rgb = (hex: string) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
};

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
        borda: '#cbd2de',
        'borda-forte': '#aeb7c9',
        // Paleta do brasão do esquadrão (menu e navegação): esquadroes/<id>.json -> cores
        noite: cores.noite,
        'noite-2': cores['noite-2'],
        'noite-3': cores['noite-3'],
        faixa: cores.faixa,
        escarlate: cores.escarlate,
        'noite-texto': cores['noite-texto'],
        'noite-fraco': cores['noite-fraco'],
      },
      boxShadow: {
        flutua: `0 10px 30px -8px rgba(${rgb(cores.noite)}, 0.45)`,
      },
      fontFamily: {
        display: ['"Bebas Neue"', 'Impact', 'sans-serif'],
        body: ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(12px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        scaleIn: { '0%': { opacity: '0', transform: 'scale(0.96)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
      },
    },
  },
  plugins: [],
} satisfies Config;
