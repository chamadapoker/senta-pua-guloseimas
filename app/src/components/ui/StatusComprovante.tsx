interface StatusComprovanteProps {
  status: 'aguardando' | 'aprovado' | 'rejeitado';
  motivo?: string | null;
}

export function StatusComprovante({ status, motivo }: StatusComprovanteProps) {
  if (status === 'aguardando') {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5 text-xs text-amber-700 flex items-center gap-1.5">
        <span>⏳</span>
        <span>Comprovante aguardando aprovação</span>
      </div>
    );
  }
  if (status === 'aprovado') {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg px-2 py-1.5 text-xs text-verde-escuro flex items-center gap-1.5">
        <span>✅</span>
        <span>Comprovante aprovado</span>
      </div>
    );
  }
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg px-2 py-1.5 text-xs text-vermelho">
      <div className="flex items-center gap-1.5 font-medium">
        <span>❌</span>
        <span>Comprovante rejeitado</span>
      </div>
      {motivo && <div className="mt-0.5 text-[10px] text-vermelho/80">Motivo: {motivo}</div>}
    </div>
  );
}
