interface StatCardProps {
  label: string;
  value: string;
  color?: string;
}

export function StatCard({ label, value, color = 'text-dourado' }: StatCardProps) {
  return (
    <div className="bg-fundo-card rounded-xl p-4 border border-borda">
      <div className="text-xs text-texto-fraco uppercase tracking-wider mb-1">{label}</div>
      <div className={`font-display text-2xl tracking-wide ${color}`}>{value}</div>
    </div>
  );
}
