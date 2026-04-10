interface BadgeProps {
  variant: 'success' | 'danger' | 'warning' | 'neutral';
  children: React.ReactNode;
}

const variants = {
  success: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20',
  danger: 'bg-vermelho/15 text-red-400 border border-vermelho/20',
  warning: 'bg-amber-500/15 text-amber-400 border border-amber-500/20',
  neutral: 'bg-fundo-elevado text-texto-fraco border border-borda',
};

export function Badge({ variant, children }: BadgeProps) {
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant]}`}>
      {children}
    </span>
  );
}
