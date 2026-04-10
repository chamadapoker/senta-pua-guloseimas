import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        azul: '#1a3a6b',
        'azul-claro': '#2456a4',
        vermelho: '#b01c2e',
        dourado: '#c8a84b',
        bg: '#f4f4f4',
        texto: '#1a1a1a',
      },
    },
  },
  plugins: [],
} satisfies Config;
