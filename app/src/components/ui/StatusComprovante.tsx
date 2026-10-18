import { Icon } from './Icon';

interface StatusComprovanteProps {
  status: 'aguardando' | 'aprovado' | 'rejeitado';
  motivo?: string | null;
}

export function StatusComprovante({ status, motivo }: StatusComprovanteProps) {
  if (status === 'aguardando') {
    return (
      <div role="status" className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-sm text-amber-800 flex items-center gap-2">
        <Icon name="clock" size={16} />
        <span>Comprovante enviado, aguardando conferência</span>
      </div>
    );
  }
  if (status === 'aprovado') {
    return (
      <div role="status" className="bg-green-50 border border-green-200 rounded-xl px-3 py-2 text-sm text-verde-escuro flex items-center gap-2">
        <Icon name="check" size={16} />
        <span>Comprovante aprovado</span>
      </div>
    );
  }
  return (
    <div role="status" className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-sm text-red-700">
      <div className="flex items-center gap-2 font-medium">
        <Icon name="x" size={16} />
        <span>Comprovante recusado. Envie outro.</span>
      </div>
      {motivo && <div className="mt-1 text-xs text-red-700">Motivo: {motivo}</div>}
    </div>
  );
}
