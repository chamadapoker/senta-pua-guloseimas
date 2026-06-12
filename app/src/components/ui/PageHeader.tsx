import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  right?: ReactNode; // ação à direita (ex: botão "+ Adicionar")
  className?: string;
}

export function PageHeader({ title, subtitle, right, className = '' }: PageHeaderProps) {
  return (
    <div className={`flex items-start justify-between gap-3 mb-5 ${className}`}>
      <div>
        <h1 className="font-display text-2xl text-azul tracking-wider">{title}</h1>
        {subtitle && <p className="text-sm text-texto-fraco mt-1">{subtitle}</p>}
      </div>
      {right && <div className="flex-shrink-0">{right}</div>}
    </div>
  );
}
