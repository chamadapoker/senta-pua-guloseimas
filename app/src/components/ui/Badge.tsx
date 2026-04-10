interface BadgeProps {
  variant: 'success' | 'danger' | 'warning' | 'neutral';
  children: React.ReactNode;
}

const variants = {
  success: 'bg-green-50 text-green-700 border border-green-200',
  danger: 'bg-red-50 text-red-700 border border-red-200',
  warning: 'bg-amber-50 text-amber-700 border border-amber-200',
  neutral: 'bg-gray-50 text-gray-600 border border-gray-200',
};

export function Badge({ variant, children }: BadgeProps) {
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant]}`}>
      {children}
    </span>
  );
}
