import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { Icon } from '../components/ui/Icon';
import { PageHeader } from '../components/ui/PageHeader';
import { api } from '../services/api';
import { getConfig } from '../services/config';
import { Loading } from '../components/ui/Loading';
import { gerarPayloadPix } from '../services/pix';
import { dataLocal } from '../services/periodo';
import { useUserAuth } from '../hooks/useUserAuth';
import { useCopiar } from '../hooks/useCopiar';

type Sala = 'oficial' | 'graduado' | null;

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface MeuCafeStatus {
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

function formatMesReferencia(ref: string): string {
  // Se for só o ano (plano anual), retorna "Ano 2026"
  if (/^\d{4}$/.test(ref)) return `Ano ${ref}`;
  const [ano, mes] = ref.split('-');
  const nomes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const mesIdx = parseInt(mes || '0') - 1;
  if (mesIdx < 0 || mesIdx >= 12) return ref;
  return `${nomes[mesIdx]}/${ano}`;
}

export function CafePublico() {
  const [searchParams] = useSearchParams();
  const { user } = useUserAuth();

  const ehMilitarEsquadrao = user && user.is_visitante === 0 && user.sala_cafe !== null;

  const userSala: Sala = user?.sala_cafe === 'oficiais' ? 'oficial'
    : user?.sala_cafe === 'graduados' ? 'graduado'
    : null;

  const salaParam = searchParams.get('sala');
  const salaInicial: Sala = userSala
    || (salaParam === 'oficial' || salaParam === 'graduado' ? salaParam : null);

  const [sala, setSala] = useState<Sala>(salaInicial);
  const [config, setConfig] = useState<Record<string, string>>({});
  const [meuStatus, setMeuStatus] = useState<MeuCafeStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [copiadoChave, setCopiadoChave] = useState(false);
  const [copiadoCodigo, setCopiadoCodigo] = useState(false);
  const [erroConfig, setErroConfig] = useState(false);
  const [erroStatus, setErroStatus] = useState(false);
  const { copiar, modalCopiaManual } = useCopiar();

  const carregarConfig = () => {
    setErroConfig(false);
    getConfig().then(setConfig).catch(() => setErroConfig(true));
  };

  const carregarStatus = () => {
    setLoadingStatus(true);
    setErroStatus(false);
    api.get<MeuCafeStatus>('/api/usuarios/me/cafe')
      .then(setMeuStatus)
      .catch(() => setErroStatus(true))
      .finally(() => setLoadingStatus(false));
  };

  useEffect(() => { carregarConfig(); }, []);

  useEffect(() => {
    if (ehMilitarEsquadrao) carregarStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ehMilitarEsquadrao]);

  const cidadePix = config.pix_guloseimas_cidade || 'ANAPOLIS';

  const avisoErroConfig = erroConfig && (
    <div role="alert" className="text-vermelho text-sm mb-4 bg-red-50 border border-red-200 rounded-xl px-3 py-2 flex items-center justify-between gap-3 flex-wrap">
      <span>Não foi possível carregar os dados do PIX.</span>
      <Button variant="chip-danger" size="sm" onClick={carregarConfig}><Icon name="refresh" size={14} /> Tentar de novo</Button>
    </div>
  );

  // Praça logado sem sala
  if (user && !user.sala_cafe) {
    return (
      <AppLayout>
        <PageHeader title="Caixinha do café" />
        <Card>
          <EmptyState
            icon={<Icon name="coffee" size={24} />}
            message="Você não participa da caixinha do café"
            hint="A caixinha é das salas de oficiais e de graduados."
            action={<Link to="/" className="inline-flex items-center min-h-[44px] px-5 rounded-xl border border-borda bg-white font-medium hover:bg-fundo-elevado">Voltar ao início</Link>}
          />
        </Card>
      </AppLayout>
    );
  }

  // Militar do esquadrão: status pessoal detalhado
  if (ehMilitarEsquadrao) {
    const tipo = userSala!;
    const chave = config[tipo === 'oficial' ? 'pix_cafe_oficial_chave' : 'pix_cafe_graduado_chave'] || '';
    const nome = config[tipo === 'oficial' ? 'pix_cafe_oficial_nome' : 'pix_cafe_graduado_nome'] || '';
    const whatsapp = config[tipo === 'oficial' ? 'pix_cafe_oficial_whatsapp' : 'pix_cafe_graduado_whatsapp'] || '';
    const nomeCantina = tipo === 'oficial' ? 'Cantina dos Oficiais' : 'Cantina dos Graduados';

    const copiarPix = async () => {
      if (!chave || !meuStatus?.total_pendente) return;
      const payload = gerarPayloadPix(meuStatus.total_pendente, { chave, nome, cidade: cidadePix });
      if (!(await copiar(payload))) return;
      setCopiadoCodigo(true);
      setTimeout(() => setCopiadoCodigo(false), 3000);
    };

    const copiarChave = async () => {
      if (!chave) return;
      if (!(await copiar(chave))) return;
      setCopiadoChave(true);
      setTimeout(() => setCopiadoChave(false), 3000);
    };

    const enviarComprovante = () => {
      if (!whatsapp || !meuStatus?.total_pendente) return;
      const msg = `Comprovante Caixinha do Café\n${user.trigrama}\nValor: R$ ${meuStatus.total_pendente.toFixed(2)}\n\n_Anexe o comprovante abaixo_`;
      window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(msg)}`, '_blank');
    };

    const mesesPendentes = meuStatus?.historico?.filter(h => h.status === 'pendente').length || 0;

    return (
      <AppLayout>
        <div className="max-w-xl mx-auto animate-fade-in">
          <PageHeader title="Meu café" subtitle={nomeCantina} />
          {avisoErroConfig}

          {loadingStatus ? (
            <Loading label="Carregando sua caixinha..." />
          ) : erroStatus ? (
            <Card size="lg" className="text-center">
              <p className="text-sm text-vermelho mb-3">Não foi possível carregar sua caixinha do café.</p>
              <Button variant="outline" size="sm" onClick={carregarStatus}><Icon name="refresh" size={16} /> Tentar de novo</Button>
            </Card>
          ) : !meuStatus?.tem_assinatura ? (
            <Card>
              <EmptyState
                icon={<Icon name="coffee" size={24} />}
                message="Você ainda não é assinante"
                hint="Fale com o responsável da cantina para começar a participar da caixinha."
              />
            </Card>
          ) : (
            <>
              {/* Mês atual */}
              <Card size="lg" className="mb-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-texto-fraco">
                    {meuStatus.mes_atual ? formatMesReferencia(meuStatus.mes_atual) : 'Mês atual'}
                  </span>
                  <Badge variant={meuStatus.mes_atual_pago ? 'success' : 'danger'}>{meuStatus.mes_atual_pago ? 'Pago' : 'Pendente'}</Badge>
                </div>
                <div className="font-display text-4xl leading-none tracking-wide text-noite mt-2">
                  {brl(meuStatus.valor_mensal || 0)}
                </div>
                <div className="text-sm text-texto-fraco mt-1.5">
                  Plano {meuStatus.plano === 'anual' ? 'anual' : 'mensal'}
                  {meuStatus.plano === 'anual' && meuStatus.mes_atual_pago && (
                    <span className="text-verde-escuro font-medium"> · válido até 31/12/{dataLocal(new Date()).slice(0, 4)}</span>
                  )}
                  {meuStatus.plano === 'anual' && !meuStatus.mes_atual_pago && (
                    <span className="text-vermelho font-medium"> · anuidade pendente</span>
                  )}
                </div>
              </Card>

              {/* Pagar o que está em aberto */}
              {(meuStatus.total_pendente || 0) > 0 && (
                <Card size="lg" className="mb-4 !border-escarlate/40">
                  <p className="text-sm font-medium text-texto-fraco">Total a pagar</p>
                  <p className="font-display text-5xl leading-none tracking-wide text-escarlate mt-1">{brl(meuStatus.total_pendente || 0)}</p>
                  {mesesPendentes > 1 && (
                    <p className="text-sm text-texto-fraco mt-1.5">{mesesPendentes} meses pendentes</p>
                  )}
                  <Button variant="success" size="lg" className="w-full mt-4 min-h-[56px]" onClick={copiarPix} disabled={!chave}>
                    <Icon name={copiadoCodigo ? 'check' : 'document'} size={20} />
                    {copiadoCodigo ? 'Código copiado' : 'Copiar código PIX'}
                  </Button>
                  <ChavePix chave={chave} nome={nome} copiado={copiadoChave} onCopiar={copiarChave} />
                  <Button variant="ghost" size="lg" className="w-full mt-3" onClick={enviarComprovante} disabled={!whatsapp}>
                    Enviar comprovante no WhatsApp
                  </Button>
                </Card>
              )}

              {/* Histórico */}
              {meuStatus.historico && meuStatus.historico.length > 0 && (
                <Card>
                  <h2 className="text-[15px] font-semibold text-noite mb-1">Histórico</h2>
                  <ul className="divide-y divide-borda">
                    {meuStatus.historico.map(h => (
                      <li key={h.referencia} className="flex items-center justify-between gap-3 text-sm py-2.5">
                        <span className="flex-1">{formatMesReferencia(h.referencia)}</span>
                        <span className="text-texto-fraco tabular-nums">{brl(h.valor)}</span>
                        <Badge variant={h.status === 'pago' ? 'success' : 'danger'}>{h.status === 'pago' ? 'Pago' : 'Pendente'}</Badge>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </>
          )}
        </div>
        {modalCopiaManual}
      </AppLayout>
    );
  }

  // Visitante ou deslogado: escolha da sala
  if (!sala) {
    return (
      <AppLayout>
        <PageHeader title="Caixinha do café" subtitle="De qual sala é o café que você tomou?" />
        <div className="grid gap-3 sm:grid-cols-2 max-w-2xl">
          {([
            { v: 'oficial', titulo: 'Cantina dos Oficiais' },
            { v: 'graduado', titulo: 'Cantina dos Graduados' },
          ] as const).map(o => (
            <button key={o.v} onClick={() => setSala(o.v)}
              className="flex items-center gap-3.5 bg-white rounded-2xl p-4 min-h-[72px] border border-borda hover:border-azul/60 active:scale-[0.99] transition-[border-color,transform] text-left outline-none focus-visible:ring-2 focus-visible:ring-azul/40">
              <span className="w-12 h-12 shrink-0 rounded-xl bg-noite text-white flex items-center justify-center"><Icon name="coffee" size={22} /></span>
              <span className="flex-1 font-semibold text-texto">{o.titulo}</span>
              <Icon name="chevron-right" size={18} className="text-texto-fraco" />
            </button>
          ))}
        </div>
      </AppLayout>
    );
  }

  const chave = config[sala === 'oficial' ? 'pix_cafe_oficial_chave' : 'pix_cafe_graduado_chave'] || '';
  const nome = config[sala === 'oficial' ? 'pix_cafe_oficial_nome' : 'pix_cafe_graduado_nome'] || '';
  const whatsapp = config[sala === 'oficial' ? 'pix_cafe_oficial_whatsapp' : 'pix_cafe_graduado_whatsapp'] || '';
  const valorStr = config[sala === 'oficial' ? 'cafe_visitante_oficial_valor' : 'cafe_visitante_graduado_valor'] || '20.00';
  const valor = parseFloat(valorStr) || 20;
  const nomeCantina = sala === 'oficial' ? 'Cantina dos Oficiais' : 'Cantina dos Graduados';

  const copiarPix = async () => {
    if (!chave) return;
    const payload = gerarPayloadPix(valor, { chave, nome, cidade: cidadePix });
    if (!(await copiar(payload))) return;
    setCopiadoCodigo(true);
    setTimeout(() => setCopiadoCodigo(false), 3000);
  };

  const copiarChave = async () => {
    if (!chave) return;
    if (!(await copiar(chave))) return;
    setCopiadoChave(true);
    setTimeout(() => setCopiadoChave(false), 3000);
  };

  const enviarComprovante = () => {
    if (!whatsapp) return;
    const msg = `Comprovante Caixinha do Café\n${nomeCantina}\nValor: R$ ${valor.toFixed(2)}\n\n_Anexe o comprovante abaixo_`;
    window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <AppLayout>
      <div className="max-w-md mx-auto animate-fade-in">
        {!userSala && (
          <button onClick={() => setSala(null)} className="inline-flex items-center gap-1.5 min-h-[44px] -ml-1 px-1 mb-1 text-sm font-medium text-texto-fraco hover:text-texto">
            <Icon name="arrow-left" size={18} /> Trocar de sala
          </button>
        )}
        <PageHeader title="Caixinha do café" subtitle={nomeCantina} />
        {avisoErroConfig}

        <Card size="lg" className="text-center">
          <p className="text-sm text-texto-fraco">Valor mensal</p>
          <p className="font-display text-6xl leading-none tracking-wide text-noite mt-1">{brl(valor)}</p>
          <Button variant="success" size="lg" className="w-full mt-5 min-h-[56px]" onClick={copiarPix} disabled={!chave}>
            {!chave ? (erroConfig ? 'Dados do PIX indisponíveis' : 'Chave PIX não configurada') : copiadoCodigo ? <><Icon name="check" size={20} /> Código copiado</> : <><Icon name="document" size={20} /> Copiar código PIX</>}
          </Button>
          <div className="text-left">
            <ChavePix chave={chave} nome={nome} copiado={copiadoChave} onCopiar={copiarChave} />
          </div>
        </Card>

        <ol className="mt-5 space-y-3">
          {[
            'Copie o código e abra o app do seu banco.',
            'Escolha "PIX copia e cola", cole e pague.',
            'Volte aqui e envie o comprovante.',
          ].map((t, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="w-7 h-7 shrink-0 rounded-full bg-noite text-white font-display text-base flex items-center justify-center">{i + 1}</span>
              <span className="text-[15px] text-texto pt-0.5">{t}</span>
            </li>
          ))}
        </ol>

        <Button variant="primary" size="lg" className="w-full mt-5" onClick={enviarComprovante} disabled={!whatsapp}>
          Enviar comprovante no WhatsApp
        </Button>
      </div>
      {modalCopiaManual}
    </AppLayout>
  );
}

function ChavePix({ chave, nome, copiado, onCopiar }: { chave: string; nome: string; copiado: boolean; onCopiar: () => void }) {
  return (
    <div className="mt-4">
      <p className="text-sm text-texto-fraco mb-1.5">Ou use a chave PIX{nome ? ` (${nome})` : ''}:</p>
      <div className="flex items-center gap-2 bg-fundo-elevado border border-borda rounded-xl pl-3.5 pr-1 py-1">
        <span className="flex-1 min-w-0 text-[15px] text-noite font-medium truncate">{chave || '—'}</span>
        <button
          type="button"
          onClick={onCopiar}
          disabled={!chave}
          aria-label="Copiar chave PIX"
          className="shrink-0 min-h-[44px] px-3 inline-flex items-center gap-1.5 rounded-lg text-sm font-medium text-azul hover:bg-white disabled:opacity-40 outline-none focus-visible:ring-2 focus-visible:ring-azul/40"
        >
          <Icon name={copiado ? 'check' : 'document'} size={16} className={copiado ? 'text-verde-escuro' : ''} />
          {copiado ? 'Copiada' : 'Copiar'}
        </button>
      </div>
    </div>
  );
}
