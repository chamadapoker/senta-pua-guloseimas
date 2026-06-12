import type { ReactNode } from 'react';

// Classe canônica de campos (input/select/textarea). Use direto em controles soltos.
export const inputClass =
  'w-full bg-white border border-borda rounded-xl px-3.5 py-2.5 text-sm text-texto focus:ring-2 focus:ring-azul/20 outline-none';

interface FieldProps {
  label?: string;
  hint?: string; // texto auxiliar abaixo do controle
  children: ReactNode; // o controle (input/select/textarea)
  className?: string;
}

export function Field({ label, hint, children, className = '' }: FieldProps) {
  return (
    <div className={className}>
      {label && <label className="block text-sm font-medium mb-1.5">{label}</label>}
      {children}
      {hint && <p className="text-xs text-texto-fraco mt-1">{hint}</p>}
    </div>
  );
}
