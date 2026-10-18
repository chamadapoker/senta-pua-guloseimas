import { useEffect, useState } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Icon } from '../ui/Icon';
import { EnviarComprovante } from '../ui/EnviarComprovante';
import { api } from '../../services/api';
import { getConfig } from '../../services/config';
import { gerarPayloadPix } from '../../services/pix';
import { useCopiar } from '../../hooks/useCopiar';

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface HistoricoItem { id?: string; referencia: string; valor: number; status: string; paid_at: string | null }

interface CafeStatus {
  tem_assinatura: boolean;
  tipo: string | null;
  plano?: string;
  valor_mensal?: number;
  mes_atual?: string;
  mes_atual_pago?: boolean;
  total_pendente?: number;
  historico?: HistoricoItem[];
  sem_sala?: boolean;
}

export function MeuCafe() {
  const [status, setStatus] = useState<CafeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<Record<string, string>>({});
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState(false);
  const { copiar, modalCopiaManual } = useCopiar();

  const carregar = () => {
    setLoading(true);
    setErro(false);
    Promise.all([
      api.get<CafeStatus>('/api/usuarios/me/cafe'),
      getConfig(),
    ]).then(([s, c]) => { setStatus(s); setConfig(c); })
      .catch(() => setErro(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => { carregar(); }, []);

  const titulo = (
    <h2 className="text-[15px] font-semibold text-noite flex items-center gap-2">
      <Icon name="coffee" size={18} /> Caixinha do café
    </h2>
  );

  if (loading) {
    return (
      <Card>
        {titulo}
        <div className="mt-3 space-y-2 animate-pulse" aria-label="Carregando café">
          <div className="h-5 w-1/3 rounded bg-fundo-elevado" />
          <div className="h-11 rounded-xl bg-fundo-elevado" />
        </div>
      </Card>
    );
  }
  if (erro) {
    return (
      <Card>
        {titulo}
        <p className="text-sm text-vermelho mt-2">Não foi possível carregar seus dados do café.</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={carregar}><Icon name="refresh" size={16} /> Tentar de novo</Button>
      </Card>
    );
  }
  if (!status || status.sem_sala) return null;

  if (!status.tem_assinatura) {
    return (
      <Card>
        {titulo}
        <p className="text-sm text-texto-fraco mt-2">Você não tem assinatura ativa. Fale com o responsável da sua sala.</p>
      </Card>
    );
  }

  const tipo = status.tipo as 'oficial' | 'graduado';
  const chave = config[tipo === 'oficial' ? 'pix_cafe_oficial_chave' : 'pix_cafe_graduado_chave'] || '';
  const nome = config[tipo === 'oficial' ? 'pix_cafe_oficial_nome' : 'pix_cafe_graduado_nome'] || '';
  const whatsapp = config[tipo === 'oficial' ? 'pix_cafe_oficial_whatsapp' : 'pix_cafe_graduado_whatsapp'] || '';
  const totalPendente = status.total_pendente || 0;

  const copiarPix = async () => {
    if (!chave || totalPendente <= 0) return;
    const payload = gerarPayloadPix(totalPendente, { chave, nome, cidade: config.pix_guloseimas_cidade || 'ANAPOLIS' });
    if (!(await copiar(payload))) return;
    setCopiado(true);
    setTimeout(() => setCopiado(false), 3000);
  };

  const enviarComprovante = () => {
    if (!whatsapp) return;
    const msg = `Comprovante Caixinha do Café\nValor: R$ ${totalPendente.toFixed(2)}\n\n_Anexe o comprovante abaixo_`;
    window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        {titulo}
        <Badge variant={status.mes_atual_pago ? 'success' : 'danger'}>{status.mes_atual_pago ? 'Mês pago' : 'Mês pendente'}</Badge>
      </div>

      <p className="text-sm text-texto-fraco mt-2">
        Mensalidade: <span className="font-display text-xl leading-none tracking-wide text-texto">{brl(status.valor_mensal || 0)}</span>
      </p>

      {totalPendente > 0 && (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3.5">
          <p className="text-sm text-red-700 font-medium">Total pendente</p>
          <p className="font-display text-4xl leading-none text-escarlate tracking-wide mt-1">{brl(totalPendente)}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
            <Button variant="success" onClick={copiarPix} disabled={!chave}>
              <Icon name={copiado ? 'check' : 'document'} size={16} /> {copiado ? 'Código copiado' : 'Copiar código PIX'}
            </Button>
            <Button variant="ghost" onClick={enviarComprovante} disabled={!whatsapp}>
              Enviar comprovante no WhatsApp
            </Button>
          </div>
          {!chave && <p className="text-xs text-red-700 mt-2">Chave PIX do café não configurada. Fale com o responsável.</p>}
        </div>
      )}

      {status.historico && status.historico.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-texto-fraco mb-1">Histórico</h3>
          <ul className="divide-y divide-borda">
            {status.historico.map(h => (
              <li key={h.id || h.referencia} className="py-2.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium">{h.referencia}</span>
                  <span className="flex items-center gap-2.5">
                    <span className="tabular-nums text-texto-fraco">{brl(h.valor)}</span>
                    <Badge variant={h.status === 'pago' ? 'success' : 'danger'}>{h.status === 'pago' ? 'Pago' : h.status === 'pendente' ? 'Pendente' : h.status}</Badge>
                  </span>
                </div>
                {h.status === 'pendente' && h.id && (
                  <div className="mt-2">
                    <EnviarComprovante origem="cafe" referenciaId={h.id} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {modalCopiaManual}
    </Card>
  );
}
