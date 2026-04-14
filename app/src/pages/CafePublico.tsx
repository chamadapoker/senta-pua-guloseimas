import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { Button } from '../components/ui/Button';
import { api } from '../services/api';
import { gerarPayloadPix } from '../services/pix';
import { useUserAuth } from '../hooks/useUserAuth';

type Sala = 'oficial' | 'graduado' | null;

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

  useEffect(() => {
    api.get<Record<string, string>>('/api/config').then(setConfig).catch(() => {});
  }, []);

  useEffect(() => {
    if (ehMilitarEsquadrao) {
      setLoadingStatus(true);
      api.get<MeuCafeStatus>('/api/usuarios/me/cafe')
        .then(setMeuStatus)
        .finally(() => setLoadingStatus(false));
    }
  }, [ehMilitarEsquadrao]);

  // Praca logado sem sala
  if (user && !user.sala_cafe) {
    return (
      <AppLayout>
        <div className="max-w-sm mx-auto py-16 text-center animate-fade-in">
          <h1 className="font-display text-2xl text-azul tracking-wider mb-3">SEM CAIXINHA</h1>
          <p className="text-texto-fraco text-sm mb-8">Praças não participam de caixinha do café.</p>
          <Link to="/" className="text-azul font-medium hover:underline">Voltar</Link>
        </div>
      </AppLayout>
    );
  }

  // Militar do esquadrão: mostra status pessoal detalhado
  if (ehMilitarEsquadrao) {
    const tipo = userSala!;
    const chave = config[tipo === 'oficial' ? 'pix_cafe_oficial_chave' : 'pix_cafe_graduado_chave'] || '';
    const nome = config[tipo === 'oficial' ? 'pix_cafe_oficial_nome' : 'pix_cafe_graduado_nome'] || '';
    const whatsapp = config[tipo === 'oficial' ? 'pix_cafe_oficial_whatsapp' : 'pix_cafe_graduado_whatsapp'] || '';
    const nomeCantina = tipo === 'oficial' ? 'Cantina dos Oficiais' : 'Cantina dos Graduados';

    const copiarPix = async () => {
      if (!chave || !meuStatus?.total_pendente) return;
      const payload = gerarPayloadPix(meuStatus.total_pendente, { chave, nome });
      await navigator.clipboard.writeText(payload);
      setCopiadoCodigo(true);
      setTimeout(() => setCopiadoCodigo(false), 3000);
    };

    const copiarChave = async () => {
      if (!chave) return;
      await navigator.clipboard.writeText(chave);
      setCopiadoChave(true);
      setTimeout(() => setCopiadoChave(false), 3000);
    };

    const enviarComprovante = () => {
      if (!whatsapp || !meuStatus?.total_pendente) return;
      const msg = `Comprovante Caixinha do Café\n${user.trigrama}\nValor: R$ ${meuStatus.total_pendente.toFixed(2)}\n\n_Anexe o comprovante abaixo_`;
      window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(msg)}`, '_blank');
    };

    return (
      <AppLayout>
        <div className="max-w-sm mx-auto animate-fade-in">
          <h1 className="font-display text-2xl text-azul tracking-wider mb-1">MEU CAFÉ</h1>
          <p className="text-sm text-texto-fraco mb-5">{nomeCantina}</p>

          {loadingStatus ? (
            <div className="text-center py-10 text-texto-fraco">Carregando...</div>
          ) : !meuStatus?.tem_assinatura ? (
            <div className="bg-white rounded-2xl border border-borda p-6 text-center shadow-sm">
              <p className="text-sm text-texto-fraco mb-2">Você ainda não é assinante.</p>
              <p className="text-xs text-texto-fraco">Fale com o administrador da cantina para começar a participar da caixinha.</p>
            </div>
          ) : (
            <>
              {/* Status do mes atual */}
              <div className={`rounded-2xl p-5 mb-4 shadow-sm border ${
                meuStatus.mes_atual_pago
                  ? 'bg-green-50 border-green-200'
                  : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs uppercase tracking-wider text-texto-fraco font-medium">
                    {meuStatus.mes_atual ? formatMesReferencia(meuStatus.mes_atual) : 'Mês atual'}
                  </span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    meuStatus.mes_atual_pago ? 'bg-verde text-white' : 'bg-vermelho text-white'
                  }`}>
                    {meuStatus.mes_atual_pago ? 'PAGO' : 'PENDENTE'}
                  </span>
                </div>
                <div className={`font-display text-3xl tracking-wider ${
                  meuStatus.mes_atual_pago ? 'text-verde-escuro' : 'text-vermelho'
                }`}>
                  R$ {(meuStatus.valor_mensal || 0).toFixed(2)}
                </div>
                <div className="text-xs text-texto-fraco mt-1">
                  Plano {meuStatus.plano === 'anual' ? 'Anual' : 'Mensal'}
                  {meuStatus.plano === 'anual' && meuStatus.mes_atual_pago && (
                    <span className="ml-2 text-verde-escuro font-medium">✓ Válido até 31/Dez/{new Date().getFullYear()}</span>
                  )}
                  {meuStatus.plano === 'anual' && !meuStatus.mes_atual_pago && (
                    <span className="ml-2 text-vermelho font-medium">Anuidade pendente</span>
                  )}
                </div>
              </div>

              {/* Pendencia total (se > valor mensal, significa acumulou) */}
              {(meuStatus.total_pendente || 0) > 0 && (
                <>
                  <div className="bg-white rounded-2xl border border-borda p-5 mb-4 shadow-sm">
                    <div className="text-xs text-texto-fraco uppercase tracking-wider mb-1">Total a pagar</div>
                    <div className="font-display text-3xl text-vermelho tracking-wider">
                      R$ {(meuStatus.total_pendente || 0).toFixed(2)}
                    </div>
                    {meuStatus.historico && meuStatus.historico.filter(h => h.status === 'pendente').length > 1 && (
                      <div className="text-xs text-texto-fraco mt-1">
                        {meuStatus.historico.filter(h => h.status === 'pendente').length} mês(es) pendente(s)
                      </div>
                    )}
                  </div>

                  {/* Chave PIX */}
                  <div className="bg-white rounded-2xl p-5 mb-4 border border-borda shadow-sm">
                    <p className="text-xs text-texto-fraco mb-1 uppercase tracking-wider text-center">Chave PIX</p>
                    <p className="text-[10px] text-texto-fraco mb-3 text-center">{nome}</p>
                    <div className="flex items-center justify-center gap-2 bg-fundo rounded-xl py-3 px-4">
                      <span className="text-sm text-azul font-medium truncate">{chave || '—'}</span>
                      <button onClick={copiarChave} disabled={!chave} className="shrink-0 p-2 rounded-lg hover:bg-white transition-colors disabled:opacity-40">
                        {copiadoChave ? (
                          <svg className="w-4 h-4 text-verde" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        ) : (
                          <svg className="w-4 h-4 text-texto-fraco" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        )}
                      </button>
                    </div>
                    {copiadoChave && <p className="text-verde text-xs mt-2 text-center">Chave copiada!</p>}
                  </div>

                  <div className="space-y-3 mb-4">
                    <Button variant="primary" size="lg" className="w-full" onClick={copiarPix} disabled={!chave}>
                      {copiadoCodigo ? 'PIX copiado!' : `Copiar PIX (R$ ${(meuStatus.total_pendente || 0).toFixed(2)})`}
                    </Button>
                    <Button variant="success" size="lg" className="w-full" onClick={enviarComprovante} disabled={!whatsapp}>
                      Enviar comprovante (WhatsApp)
                    </Button>
                  </div>
                </>
              )}

              {/* Historico */}
              {meuStatus.historico && meuStatus.historico.length > 0 && (
                <div className="bg-white rounded-2xl border border-borda p-4 shadow-sm">
                  <div className="text-xs text-texto-fraco uppercase tracking-wider mb-3">Histórico</div>
                  <div className="space-y-2">
                    {meuStatus.historico.map(h => (
                      <div key={h.referencia} className="flex items-center justify-between text-sm py-1.5 border-b border-borda last:border-0">
                        <span className="text-texto-fraco">{formatMesReferencia(h.referencia)}</span>
                        <span className="text-texto-fraco">R$ {h.valor.toFixed(2)}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          h.status === 'pago' ? 'bg-green-100 text-verde-escuro' : 'bg-red-50 text-vermelho'
                        }`}>
                          {h.status === 'pago' ? 'Pago' : 'Pendente'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </AppLayout>
    );
  }

  // Visitante ou deslogado: fluxo de pagamento com valor fixo
  if (!sala) {
    return (
      <AppLayout>
        <div className="py-6 animate-fade-in">
          <div className="text-center mb-8">
            <h1 className="font-display text-2xl text-azul tracking-wider mb-2">CAIXINHA DO CAFÉ</h1>
            <p className="text-sm text-texto-fraco">Escolha sua cantina</p>
          </div>
          <div className="space-y-4 max-w-sm mx-auto">
            <button onClick={() => setSala('oficial')}
              className="w-full bg-white rounded-2xl p-5 border border-borda hover:border-azul shadow-sm transition-all text-left">
              <h2 className="font-display text-lg text-azul tracking-wide uppercase">Cantina dos Oficiais</h2>
            </button>
            <button onClick={() => setSala('graduado')}
              className="w-full bg-white rounded-2xl p-5 border border-borda hover:border-vermelho shadow-sm transition-all text-left">
              <h2 className="font-display text-lg text-vermelho tracking-wide uppercase">Cantina dos Graduados</h2>
            </button>
          </div>
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
    const payload = gerarPayloadPix(valor, { chave, nome });
    await navigator.clipboard.writeText(payload);
    setCopiadoCodigo(true);
    setTimeout(() => setCopiadoCodigo(false), 3000);
  };

  const copiarChave = async () => {
    if (!chave) return;
    await navigator.clipboard.writeText(chave);
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
      <div className="max-w-sm mx-auto animate-fade-in">
        <div className="flex items-center gap-3 mb-4">
          {!userSala && (
            <button onClick={() => setSala(null)} className="text-texto-fraco hover:text-texto" aria-label="Voltar">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
          )}
          <h1 className="font-display text-xl text-azul tracking-wider uppercase">Caixinha do Café</h1>
        </div>
        <p className="text-sm text-texto-fraco mb-6">{nomeCantina}</p>

        <div className="bg-azul rounded-2xl p-6 mb-4 text-center text-white shadow-sm">
          <div className="text-xs opacity-70 uppercase tracking-widest">Valor mensal</div>
          <div className="font-display text-4xl tracking-wider mt-1">R$ {valor.toFixed(2)}</div>
        </div>

        <div className="bg-white rounded-2xl p-5 mb-4 border border-borda shadow-sm">
          <p className="text-xs text-texto-fraco mb-1 uppercase tracking-wider text-center">Chave PIX</p>
          <p className="text-[10px] text-texto-fraco mb-3 text-center">{nome}</p>
          <div className="flex items-center justify-center gap-2 bg-fundo rounded-xl py-3 px-4">
            <span className="text-sm text-azul font-medium truncate">{chave || '—'}</span>
            <button onClick={copiarChave} disabled={!chave} className="shrink-0 p-2 rounded-lg hover:bg-white transition-colors disabled:opacity-40" aria-label="Copiar chave PIX">
              {copiadoChave ? (
                <svg className="w-4 h-4 text-verde" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              ) : (
                <svg className="w-4 h-4 text-texto-fraco" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              )}
            </button>
          </div>
          {copiadoChave && <p className="text-verde text-xs mt-2 text-center">Chave copiada!</p>}
        </div>

        <div className="space-y-3">
          <Button variant="primary" size="lg" className="w-full" onClick={copiarPix} disabled={!chave}>
            {!chave ? 'Chave PIX não configurada' : copiadoCodigo ? 'PIX copiado!' : 'Copiar código PIX'}
          </Button>
          <Button variant="success" size="lg" className="w-full" onClick={enviarComprovante} disabled={!whatsapp}>
            Enviar comprovante (WhatsApp)
          </Button>
        </div>

        <p className="text-center text-xs text-texto-fraco mt-6">
          Após pagar, envie o comprovante pelo botão acima.
        </p>
      </div>
    </AppLayout>
  );
}
