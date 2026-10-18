import type { ReactNode } from 'react';

interface EmptyStateProps {
  message: string;
  hint?: string; // o que a pessoa pode fazer a seguir
  icon?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ message, hint, icon, action }: EmptyStateProps) {
  return (
    <div className="text-center py-12 px-4">
      {icon && (
        <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-fundo-elevado border border-borda flex items-center justify-center text-texto-fraco">
          {icon}
        </div>
      )}
      <p className="text-[15px] font-medium text-texto">{message}</p>
      {hint && <p className="text-sm text-texto-fraco mt-1 max-w-sm mx-auto">{hint}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
