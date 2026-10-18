import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  right?: ReactNode; // ações à direita (ex: botão "Adicionar")
  className?: string;
}

// Título de página: Bebas em azul-noite com a flâmula na cor de destaque embaixo (a mesma marca do item ativo do menu)
export function PageHeader({ title, subtitle, right, className = '' }: PageHeaderProps) {
  return (
    <div className={`flex items-end justify-between gap-x-4 gap-y-3 flex-wrap mb-6 ${className}`}>
      <div className="min-w-0">
        <h1 className="font-display text-[1.75rem] sm:text-3xl leading-none text-noite tracking-wide">{title}</h1>
        <span className="flamula-sm block w-10 h-1.5 bg-destaque mt-2" aria-hidden="true" />
        {subtitle && <p className="text-sm text-texto-fraco mt-2 max-w-prose">{subtitle}</p>}
      </div>
      {right && <div className="flex items-center gap-2 flex-wrap">{right}</div>}
    </div>
  );
}
