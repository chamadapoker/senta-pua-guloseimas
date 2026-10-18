interface LoadingProps {
  label?: string;
}

export function Loading({ label = 'Carregando...' }: LoadingProps) {
  return (
    <div role="status" className="flex flex-col items-center justify-center gap-3 py-14 text-texto-fraco">
      <span className="w-8 h-8 rounded-full border-[3px] border-borda border-t-escarlate animate-spin" aria-hidden="true" />
      <span className="text-sm">{label}</span>
    </div>
  );
}
