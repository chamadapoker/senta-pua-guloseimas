interface BadgeProps {
  variant: 'success' | 'danger' | 'warning' | 'neutral';
  children: React.ReactNode;
}

const variants = {
  success: 'bg-green-100 text-green-800',
  danger: 'bg-red-100 text-red-800',
  warning: 'bg-yellow-100 text-yellow-800',
  neutral: 'bg-gray-100 text-gray-800',
};

export function Badge({ variant, children }: BadgeProps) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${variants[variant]}`}>
      {children}
    </span>
  );
}
