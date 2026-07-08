import { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'success' | 'danger' | 'outline' | 'ghost'
    | 'chip' | 'chip-primary' | 'chip-success' | 'chip-warning' | 'chip-danger';
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

const variants = {
  primary: 'bg-azul text-white hover:bg-azul-claro shadow-sm',
  success: 'bg-verde text-white hover:bg-verde-escuro shadow-sm',
  danger: 'bg-vermelho text-white hover:bg-red-700 shadow-sm',
  outline: 'border-2 border-azul text-azul hover:bg-azul hover:text-white',
  ghost: 'bg-fundo-elevado text-texto border border-borda hover:bg-borda',
  // Chips: para ações em linha (listas). Fundo + borda = sempre visíveis.
  chip: 'bg-fundo-elevado text-texto border border-borda hover:bg-borda font-medium',
  'chip-primary': 'bg-blue-50 text-azul border border-blue-200 hover:bg-blue-100 font-medium',
  'chip-success': 'bg-green-50 text-verde-escuro border border-green-200 hover:bg-green-100 font-medium',
  // Âmbar: ações reversíveis (Desativar, Bloquear, Fechar) — distingue de exclusão permanente (vermelho).
  'chip-warning': 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 font-medium',
  'chip-danger': 'bg-red-50 text-vermelho border border-red-200 hover:bg-red-100 font-medium',
};

const sizes = {
  xs: 'px-2.5 py-1 text-xs',
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-5 py-2.5 text-base',
  lg: 'px-6 py-3.5 text-lg font-semibold',
};

export function Button({ variant = 'primary', size = 'md', className = '', children, ...props }: ButtonProps) {
  return (
    <button
      className={`rounded-xl font-medium transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97] ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
