import { useNavigate, Link } from 'react-router-dom';

interface BackButtonProps {
  to?: string;
  label?: string;
  className?: string;
}

export function BackButton({ to, label = 'Voltar', className = '' }: BackButtonProps) {
  const navigate = useNavigate();
  const base = `inline-flex items-center gap-1.5 text-sm text-texto-fraco hover:text-azul transition-colors ${className}`;

  const content = (
    <>
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
      <span>{label}</span>
    </>
  );

  if (to) {
    return <Link to={to} className={base}>{content}</Link>;
  }
  return (
    <button type="button" onClick={() => navigate(-1)} className={base}>
      {content}
    </button>
  );
}
