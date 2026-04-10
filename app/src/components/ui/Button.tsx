import { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'success' | 'danger' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

const variants = {
  primary: 'bg-azul text-white hover:bg-azul-claro',
  success: 'bg-verde text-white hover:bg-verde-escuro shadow-sm',
  danger: 'bg-vermelho text-white hover:bg-red-700 shadow-sm',
  outline: 'border-2 border-azul text-azul hover:bg-azul hover:text-white',
  ghost: 'text-texto-fraco hover:text-texto hover:bg-fundo-elevado',
};

const sizes = {
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
