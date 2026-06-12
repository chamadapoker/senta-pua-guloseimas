import type { HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  size?: 'md' | 'lg'; // md = p-4 (padrão), lg = p-5
}

export function Card({ size = 'md', className = '', children, ...props }: CardProps) {
  const pad = size === 'lg' ? 'p-5' : 'p-4';
  return (
    <div className={`bg-white border border-borda rounded-2xl shadow-sm ${pad} ${className}`} {...props}>
      {children}
    </div>
  );
}
