import { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string;
  color?: string;
  icon?: ReactNode;
  trend?: string;
}

export function StatCard({ label, value, color = 'text-azul', icon, trend }: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-borda shadow-sm hover:shadow-md transition-all duration-300 group overflow-hidden relative">
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] font-bold text-texto-fraco uppercase tracking-widest">{label}</div>
          {icon && <div className={`${color} opacity-20 group-hover:opacity-40 transition-opacity`}>{icon}</div>}
        </div>
        <div className={`font-display text-3xl tracking-tight ${color} mb-1`}>{value}</div>
        {trend && (
          <div className="text-[10px] font-medium text-verde-escuro flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
            {trend} em relação ao mês anterior
          </div>
        )}
      </div>
      {/* Subtle background glow */}
      <div className={`absolute -right-4 -bottom-4 w-20 h-20 rounded-full blur-3xl opacity-5 ${color.replace('text-', 'bg-')}`} />
    </div>
  );
}
