import { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string;
  color?: string; // classe de texto do valor (ex.: text-verde)
  icon?: ReactNode;
  trend?: string;
  hint?: string;
}

export function StatCard({ label, value, color = 'text-azul', icon, trend, hint }: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 border border-borda shadow-sm min-w-0">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="text-sm text-texto-fraco leading-snug">{label}</div>
        {icon && <div className={`${color} shrink-0 opacity-80`}>{icon}</div>}
      </div>
      <div className={`font-display text-[2rem] leading-none tracking-wide ${color} truncate`}>{value}</div>
      {trend && (
        <div className="text-xs font-medium text-verde-escuro mt-2">{trend} em relação ao mês anterior</div>
      )}
      {hint && <div className="text-xs text-texto-fraco mt-2">{hint}</div>}
    </div>
  );
}
