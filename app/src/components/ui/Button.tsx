import { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'success' | 'danger' | 'outline' | 'ghost'
    | 'chip' | 'chip-primary' | 'chip-success' | 'chip-warning' | 'chip-danger';
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

const variants = {
  primary: 'bg-azul text-white hover:bg-azul-claro shadow-sm',
  success: 'bg-verde text-white hover:bg-verde-escuro shadow-sm',
  danger: 'bg-escarlate text-white hover:bg-red-700 shadow-sm',
  outline: 'border-2 border-azul text-azul hover:bg-azul hover:text-white',
  ghost: 'bg-white text-texto border border-borda hover:bg-fundo-elevado hover:border-borda-forte',
  // Chips: para ações em linha (listas). Fundo + borda = sempre visíveis.
  chip: 'bg-fundo-elevado text-texto border border-borda hover:bg-borda font-medium',
  'chip-primary': 'bg-blue-50 text-azul border border-blue-200 hover:bg-blue-100 font-medium',
  'chip-success': 'bg-green-50 text-verde-escuro border border-green-200 hover:bg-green-100 font-medium',
  // Âmbar: ações reversíveis (Desativar, Bloquear, Fechar) — distingue de exclusão permanente (vermelho).
  'chip-warning': 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 font-medium',
  'chip-danger': 'bg-red-50 text-vermelho border border-red-200 hover:bg-red-100 font-medium',
};

// Alturas mínimas pensando no toque: sm/md/lg passam de 40px; xs é só para chips dentro de listas densas
const sizes = {
  xs: 'min-h-[32px] px-2.5 text-xs',
  sm: 'min-h-[40px] px-3.5 text-sm',
  md: 'min-h-[44px] px-5 text-[15px]',
  lg: 'min-h-[52px] px-6 text-base font-semibold',
};

export function Button({ variant = 'primary', size = 'md', className = '', children, type = 'button', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-[background-color,border-color,color,transform] duration-150
        outline-none focus-visible:ring-2 focus-visible:ring-azul/40 focus-visible:ring-offset-2
        disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97]
        ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
