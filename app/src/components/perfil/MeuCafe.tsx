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
import { useUserAuth } from '../../hooks/useUserAuth';
import type { MeuCafeStatus as CafeStatus, SalaCafeTipo } from '../../types';
import { mesCurto, nomeSalaCafe, pixSalaCafe, rotuloReferencia, salaDaCategoria } from '../../pages/admin/cafe/SalaCafe';

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function MeuCafe() {
  const [status, setStatus] = useState<CafeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<Record<string, string>>({});
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState(false);
  const { copiar, modalCopiaManual } = useCopiar();
  const { user } = useUserAuth();

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
  if (!status) return null;

  // Sala vem do servidor (segue a categoria); sem o campo (backend antigo), usa o comportamento anterior
  const salaServidor = 'sala' in status ? status.sala ?? null : undefined;
  const sala: SalaCafeTipo | null = salaServidor !== undefined
    ? salaServidor
    : status.sem_sala ? null
    : (status.tipo === 'oficial' || status.tipo === 'graduado') ? status.tipo
    : salaDaCategoria(user?.categoria);

  if (sala === null) {
    return (
      <Card>
        {titulo}
        <p className="text-sm text-texto-fraco mt-2">
          A caixinha do café é das salas de oficiais e de graduados, por isso não há cobrança de café para você. A cantina e a loja continuam à disposição.
        </p>
      </Card>
    );
  }

  const nomeSala = nomeSalaCafe(config, sala);

  if (!status.tem_assinatura) {
    return (
      <Card>
        {titulo}
        <p className="text-sm text-texto-fraco mt-2">Você não tem assinatura ativa na {nomeSala}. Fale com o responsável da sua sala.</p>
      </Card>
    );
  }

  const { chave, nome, whatsapp } = pixSalaCafe(config, sala);
  const totalPendente = status.total_pendente || 0;
  const anual = status.plano === 'anual';
  const valorPlano = status.valor ?? status.valor_mensal ?? 0;
  const historico = status.historico ?? status.pagamentos ?? [];
  const validoAte = status.valido_ate;

  const copiarPix = async () => {
    if (!chave || totalPendente <= 0) return;
    const payload = gerarPayloadPix(totalPendente, { chave, nome, cidade: config.pix_guloseimas_cidade || 'ANAPOLIS' });
    if (!(await copiar(payload))) return;
    setCopiado(true);
    setTimeout(() => setCopiado(false), 3000);
  };

  const enviarComprovante = () => {
    if (!whatsapp) return;
    const msg = `Comprovante Caixinha do Café\n${nomeSala}\nValor: R$ ${totalPendente.toFixed(2)}\n\n_Anexe o comprovante abaixo_`;
    window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        {titulo}
        {anual
          ? <Badge variant={status.mes_atual_pago ? 'success' : 'danger'}>{status.mes_atual_pago ? 'Anuidade paga' : 'Anuidade em aberto'}</Badge>
          : <Badge variant={status.mes_atual_pago ? 'success' : 'danger'}>{status.mes_atual_pago ? 'Mês pago' : 'Mês pendente'}</Badge>}
      </div>
      <p className="text-xs text-texto-fraco mt-0.5">{nomeSala}</p>

      <p className="text-sm text-texto-fraco mt-2">
        {anual ? 'Anuidade' : 'Mensalidade'}: <span className="font-display text-xl leading-none tracking-wide text-texto">{brl(valorPlano)}</span>
      </p>
      {anual && validoAte && (
        <p className="text-sm text-verde-escuro font-medium mt-1">Anuidade válida até {mesCurto(validoAte)}</p>
      )}

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

      {historico.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-texto-fraco mb-1">Histórico</h3>
          <ul className="divide-y divide-borda">
            {historico.map(h => (
              <li key={h.id || h.referencia} className="py-2.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium">{rotuloReferencia(h)}</span>
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
