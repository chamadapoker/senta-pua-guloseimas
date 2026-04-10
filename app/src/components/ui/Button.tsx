import { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'danger' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

const variants = {
  primary: 'bg-azul text-white hover:bg-azul-claro border border-azul-claro/30',
  danger: 'bg-vermelho text-white hover:bg-vermelho-escuro border border-vermelho/50 shadow-lg shadow-vermelho/20',
  outline: 'border-2 border-dourado/60 text-dourado hover:bg-dourado/10',
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
      className={`rounded-lg font-medium transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97] ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
