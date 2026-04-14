import { useEffect, useState } from 'react';
import { Button } from '../ui/Button';
import { api } from '../../services/api';
import { gerarPayloadPix } from '../../services/pix';

interface CafeStatus {
  tem_assinatura: boolean;
  tipo: string | null;
  plano?: string;
  valor_mensal?: number;
  mes_atual?: string;
  mes_atual_pago?: boolean;
  total_pendente?: number;
  historico?: { referencia: string; valor: number; status: string; paid_at: string | null }[];
  sem_sala?: boolean;
}

export function MeuCafe() {
  const [status, setStatus] = useState<CafeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<Record<string, string>>({});
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<CafeStatus>('/api/usuarios/me/cafe'),
      api.get<Record<string, string>>('/api/config'),
    ]).then(([s, c]) => { setStatus(s); setConfig(c); }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="bg-white rounded-xl border border-borda p-4 text-sm text-texto-fraco text-center">Carregando café...</div>;
  if (!status || status.sem_sala) return null;

  if (!status.tem_assinatura) {
    return (
      <div className="bg-white rounded-xl border border-borda p-4">
        <div className="text-sm font-medium text-texto-fraco mb-2">Meu Café</div>
        <p className="text-xs text-texto-fraco">Você não tem assinatura ativa. Fale com o administrador.</p>
      </div>
    );
  }

  const tipo = status.tipo as 'oficial' | 'graduado';
  const chave = config[tipo === 'oficial' ? 'pix_cafe_oficial_chave' : 'pix_cafe_graduado_chave'] || '';
  const nome = config[tipo === 'oficial' ? 'pix_cafe_oficial_nome' : 'pix_cafe_graduado_nome'] || '';
  const whatsapp = config[tipo === 'oficial' ? 'pix_cafe_oficial_whatsapp' : 'pix_cafe_graduado_whatsapp'] || '';
  const totalPendente = status.total_pendente || 0;

  const copiarPix = async () => {
    if (!chave || totalPendente <= 0) return;
    const payload = gerarPayloadPix(totalPendente, { chave, nome });
    await navigator.clipboard.writeText(payload);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 3000);
  };

  const enviarComprovante = () => {
    if (!whatsapp) return;
    const msg = `Comprovante Caixinha do Café\nValor: R$ ${totalPendente.toFixed(2)}\n\n_Anexe o comprovante abaixo_`;
    window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="bg-white rounded-xl border border-borda p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-texto-fraco">Meu Café</div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status.mes_atual_pago ? 'bg-green-100 text-verde-escuro' : 'bg-red-50 text-vermelho'}`}>
          {status.mes_atual_pago ? 'Pago' : 'Pendente'}
        </span>
      </div>

      <div className="flex items-baseline gap-2">
        <div className="text-xs text-texto-fraco">Mensalidade:</div>
        <div className="font-display text-azul text-lg tracking-wider">R$ {(status.valor_mensal || 0).toFixed(2)}</div>
      </div>

      {totalPendente > 0 && (
        <>
          <div className="bg-red-50 rounded-lg p-3">
            <div className="text-xs text-vermelho font-medium">Total pendente</div>
            <div className="font-display text-2xl text-vermelho tracking-wider">R$ {totalPendente.toFixed(2)}</div>
          </div>
          <div className="flex gap-2">
            <Button variant="primary" size="sm" className="flex-1" onClick={copiarPix}>
              {copiado ? 'Copiado!' : 'Copiar PIX'}
            </Button>
            <Button variant="success" size="sm" className="flex-1" onClick={enviarComprovante}>
              Enviar Comprovante
            </Button>
          </div>
        </>
      )}

      {status.historico && status.historico.length > 0 && (
        <div>
          <div className="text-xs text-texto-fraco mb-1.5 mt-2">Histórico</div>
          <div className="space-y-1">
            {status.historico.map(h => (
              <div key={h.referencia} className="flex items-center justify-between text-xs py-1 border-b border-borda last:border-0">
                <span>{h.referencia}</span>
                <span className="text-texto-fraco">R$ {h.valor.toFixed(2)}</span>
                <span className={h.status === 'pago' ? 'text-verde-escuro' : 'text-vermelho'}>{h.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
