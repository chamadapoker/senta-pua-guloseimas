interface LoadingProps {
  label?: string;
}

export function Loading({ label = 'Carregando...' }: LoadingProps) {
  return <div className="text-center py-10 text-texto-fraco">{label}</div>;
}
