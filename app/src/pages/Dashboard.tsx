import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { EnviarComprovante } from '../components/ui/EnviarComprovante';
import { StatusComprovante } from '../components/ui/StatusComprovante';
import { useComprovantesStatus } from '../hooks/useComprovantesStatus';
import { BirthdaySurprise } from '../components/ui/BirthdaySurprise';
import { api } from '../services/api';
import { useUserAuth } from '../hooks/useUserAuth';
import { Loading } from '../components/ui/Loading';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { Icon, type IconName } from '../components/ui/Icon';
import { AtalhosHome, HeroSentaPua } from '../components/catalogo/AtalhosHome';
import { Button } from '../components/ui/Button';
import { useToast } from '../hooks/useToast';
import { dataLocal } from '../services/periodo';
import { formatarDataBanco, formatarDiaRelativo } from '../services/datas';
import type { Usuario, SalaCafeTipo, PlanoCafe } from '../types';
import { getConfig } from '../services/config';
import { mesCurto, nomeSalaCafe, rotuloReferencia } from './admin/cafe/SalaCafe';

const WORKER_URL = import.meta.env.VITE_WORKER_URL || '';
function resolveImg(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith('/api') ? `${WORKER_URL}${url}` : url;
}

interface PedidoItem {
  nome_produto: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
}

interface PedidoResumo {
  id: string;
  total: number;
  status: string;
  metodo_pagamento: string;
  created_at: string;
  paid_at: string | null;
  itens: PedidoItem[];
}

interface CafeStatus {
  mes_atual: string;
  pago: boolean;
  valor: number | null;
  tem_assinatura: boolean;
  // Contrato novo (opcionais: backend antigo não manda)
  sala?: SalaCafeTipo | null;
  plano?: PlanoCafe | string;
  valido_ate?: string | null;
  rotulo?: string | null;
  periodo_fim?: string | null;
}

interface Totais {
  cantina: { gasto: number; pago: number; pendente: number; compras: number };
  cafe: { pago: number; pendente: number };
  ximboca: { pago: number; pendente: number };
  geral: { pago: number; pendente: number };
}

interface DashboardData {
  user: Usuario;
  debito_total: number;
  ultimos_pedidos: PedidoResumo[];
  cafe_status: CafeStatus | null;
  totais?: Totais;
  aniversario?: { titulo: string; texto: string; imagem_url: string | null } | null;
}

const CATEGORIA_LABEL: Record<string, string> = {
  oficial: 'Oficial',
  graduado: 'Graduado/SO',
  praca: 'Praça',
};

// created_at vem do banco em UTC; exibe no fuso de Brasília
const formatData = formatarDiaRelativo;

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const STATUS_PEDIDO: Record<string, { label: string; variant: 'success' | 'danger' | 'warning' | 'neutral' }> = {
  pago: { label: 'Pago', variant: 'success' },
  fiado: { label: 'Fiado', variant: 'danger' },
  pendente: { label: 'Pendente', variant: 'warning' },
  aguardando: { label: 'Aguardando', variant: 'warning' },
  cancelado: { label: 'Cancelado', variant: 'neutral' },
};
function statusPedido(s: string) {
  return STATUS_PEDIDO[s] ?? { label: s.charAt(0).toUpperCase() + s.slice(1), variant: 'warning' as const };
}

export function Dashboard() {
  const { user } = useUserAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(false);
  const [showBirthday, setShowBirthday] = useState(false);
  const comprov = useComprovantesStatus();
  const { showToast } = useToast();
  const [configPub, setConfigPub] = useState<Record<string, string>>({});
  useEffect(() => { getConfig().then(setConfigPub).catch(() => {}); }, []);

  const carregar = () => {
    setLoading(true);
    setErro(false);
    api.get<DashboardData>('/api/usuarios/me/dashboard')
      .then(d => {
        setData(d);
        if (d.aniversario) {
          // Chave pelo dia de Brasília (toISOString usaria o dia UTC)
          const key = `niver_visto_${dataLocal(new Date())}`;
          try {
            if (!localStorage.getItem(key)) {
              setShowBirthday(true);
              localStorage.setItem(key, '1');
            }
          } catch { setShowBirthday(true); }
        }
      })
      .catch(() => setErro(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => { carregar(); }, []);

  const [baixando, setBaixando] = useState(false);
  const baixarExtrato = async () => {
    if (baixando) return;
    setBaixando(true);
    try {
      const { gerarExtratoUnificadoPDF } = await import('../services/pdf');
      const d = await api.get<any>('/api/usuarios/me/extrato');
      const fmt = (iso: string) => formatarDataBanco(iso);
      const total = d.guloseimas.filter((p: any) => p.status !== 'pago').reduce((s: number, p: any) => s + p.total, 0)
        + d.loja.filter((p: any) => p.status !== 'pago').reduce((s: number, p: any) => s + p.total, 0)
        + d.cafe.filter((p: any) => p.status === 'pendente').reduce((s: number, p: any) => s + p.valor, 0)
        + d.ximboca.filter((p: any) => p.status !== 'pago').reduce((s: number, p: any) => s + (p.valor_individual ?? p.valor_por_pessoa), 0);
      // PIX do café: sala do servidor quando vier; senão, a do assinante no extrato
      const salaCafeServ = data?.cafe_status?.sala;
      const cafeGraduado: boolean | SalaCafeTipo = salaCafeServ ?? d.cafe.some((p: any) => p.cafe_tipo === 'graduado');
      await gerarExtratoUnificadoPDF(d.cliente.nome_guerra, {
        guloseimas: d.guloseimas.filter((p: any) => p.status !== 'pago').map((p: any) => ({ itens: p.itens_resumo || '-', valor: p.total, data: fmt(p.created_at) })),
        loja: d.loja.filter((p: any) => p.status !== 'pago').map((p: any) => ({ itens: p.itens_resumo || '-', valor: p.total, data: fmt(p.created_at), parcelas: p.parcelas })),
        cafe: d.cafe.filter((p: any) => p.status === 'pendente').map((p: any) => ({ referencia: rotuloReferencia(p), valor: p.valor, tipo: `${p.cafe_tipo} - ${p.cafe_plano}` })),
        ximboca: d.ximboca.filter((p: any) => p.status !== 'pago').map((p: any) => ({ evento: p.evento_nome, data: formatarDataBanco(p.evento_data), valor: p.valor_individual ?? p.valor_por_pessoa })),
      }, total, cafeGraduado);
    } catch {
      showToast('Erro ao gerar extrato', 'error');
    } finally {
      setBaixando(false);
    }

  };

  if (!user) return null;

  const foto = resolveImg(user.foto_url);
  // Sala do café: a do servidor (segue a categoria); sem o campo, a sala_cafe do cadastro
  const cs = data?.cafe_status ?? null;
  const salaCafe: SalaCafeTipo | null = cs && cs.sala !== undefined
    ? cs.sala
    : user.sala_cafe === 'oficiais' ? 'oficial' : user.sala_cafe === 'graduados' ? 'graduado' : null;
  const cafeAnual = cs?.plano === 'anual' || /^\d{4}$/.test(cs?.mes_atual || '');
  const pendenteTotal = data ? (data.totais ? data.totais.geral.pendente : data.debito_total) : 0;
  const temPedidoAberto = data ? data.ultimos_pedidos.some(p => p.status !== 'pago') : false;
  const linkAcao = 'inline-flex items-center min-h-[44px] text-sm font-medium text-azul underline underline-offset-2';

  // O que ele deve, por área (só as que têm valor)
  const areas: { chave: string; icon: IconName; titulo: string; valor: number; acao: React.ReactNode }[] = [];
  if (data?.totais) {
    const t = data.totais;
    if (t.cantina.pendente > 0) areas.push({
      chave: 'cantina', icon: 'cutlery', titulo: 'Cantina', valor: t.cantina.pendente,
      acao: temPedidoAberto
        ? <a href="#pedidos" className={linkAcao}>Enviar comprovante</a>
        : <Link to="/perfil" className={linkAcao}>Ver extrato</Link>,
    });
    if (t.cafe.pendente > 0) areas.push({
      chave: 'cafe', icon: 'coffee', titulo: 'Café', valor: t.cafe.pendente,
      acao: <Link to="/cafe" className={linkAcao}>Pagar</Link>,
    });
    if (t.ximboca.pendente > 0) areas.push({
      chave: 'ximboca', icon: 'fire', titulo: 'Ximboca', valor: t.ximboca.pendente,
      acao: <Link to="/ximboca" className={linkAcao}>Pagar</Link>,
    });
  }

  return (
    <AppLayout>
      {showBirthday && data?.aniversario && (
        <BirthdaySurprise
          titulo={data.aniversario.titulo}
          texto={data.aniversario.texto}
          imagemUrl={data.aniversario.imagem_url}
          onClose={() => setShowBirthday(false)}
        />
      )}

      <h1 className="sr-only">Início</h1>
      <HeroSentaPua linha={<>Olá, <strong className="text-white font-semibold">{user.trigrama}</strong>. Peça na cantina, pague no PIX e acompanhe sua conta.</>}>
        <Link to="/perfil" className="inline-flex items-center gap-3 rounded-xl bg-noite-2 px-3 py-2 min-h-[48px] hover:bg-noite-3 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/60">
          {foto ? (
            <img src={foto} alt="" className="w-9 h-9 rounded-full object-cover" />
          ) : (
            <span className="w-9 h-9 rounded-full bg-faixa flex items-center justify-center font-display text-white text-base tracking-wide">{user.trigrama}</span>
          )}
          <span className="text-sm">
            <span className="block text-white font-medium leading-tight">Meu perfil</span>
            <span className="block text-noite-texto text-xs">{CATEGORIA_LABEL[user.categoria] || user.categoria}</span>
          </span>
        </Link>
      </HeroSentaPua>

      {user.acesso_bloqueado && (
        <div role="alert" className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4 flex items-start gap-3">
          <Icon name="warning" size={20} className="text-amber-700 mt-0.5" />
          <div className="text-sm text-amber-900">
            <div className="font-medium">Seu acesso de visitante expirou ou foi pausado</div>
            <div className="mt-1">Você não pode fazer compras agora. <Link to="/acesso-expirado" className="underline font-medium">Renovar acesso</Link></div>
          </div>
        </div>
      )}

      {loading && <Loading label="Carregando sua conta..." />}

      {!loading && erro && (
        <Card size="lg" className="mb-5 text-center">
          <p className="text-sm text-vermelho mb-3">Não foi possível carregar seus dados.</p>
          <Button variant="outline" size="sm" onClick={carregar}><Icon name="refresh" size={16} /> Tentar de novo</Button>
        </Card>
      )}

      {!loading && data && (
        <>
          {/* O que ele deve */}
          {pendenteTotal > 0 ? (
            <Card size="lg" className="mb-6 !border-escarlate/40">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-texto-fraco">Você deve</p>
                  <p className="font-display text-5xl leading-none text-escarlate tracking-wide mt-1">{brl(pendenteTotal)}</p>
                </div>
                <span className="w-11 h-11 rounded-xl bg-red-50 text-escarlate flex items-center justify-center shrink-0">
                  <Icon name="warning" size={22} />
                </span>
              </div>

              {areas.length > 0 && (
                <ul className="mt-4 divide-y divide-borda border-y border-borda">
                  {areas.map(a => (
                    <li key={a.chave} className="flex items-center gap-3 py-1.5">
                      <Icon name={a.icon} size={18} className="text-texto-fraco" />
                      <span className="flex-1 min-w-0">
                        <span className="block text-[15px] leading-tight">{a.titulo}</span>
                        <span className="block font-display text-xl tracking-wide text-texto leading-tight">{brl(a.valor)}</span>
                      </span>
                      {a.acao}
                    </li>
                  ))}
                </ul>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
                <Button variant="ghost" onClick={baixarExtrato} disabled={baixando}>
                  <Icon name="download" size={16} /> {baixando ? 'Gerando PDF...' : 'Baixar extrato (PDF)'}
                </Button>
                <Link to="/perfil" className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 rounded-xl font-medium text-[15px] bg-white text-texto border border-borda hover:bg-fundo-elevado">
                  <Icon name="document" size={16} /> Ver extrato completo
                </Link>
              </div>
            </Card>
          ) : (
            <Card className="mb-6 flex items-center gap-3">
              <span className="w-11 h-11 rounded-xl bg-green-50 text-verde-escuro flex items-center justify-center shrink-0">
                <Icon name="check" size={22} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-texto">Tudo em dia</p>
                <p className="text-sm text-texto-fraco">
                  Nenhum valor pendente.{data.totais && data.totais.geral.pago > 0 && <> Total já pago: {brl(data.totais.geral.pago)}.</>}
                </p>
              </div>
            </Card>
          )}

          <h2 className="text-[15px] font-semibold text-noite mb-3">Atalhos</h2>
          <div className="mb-6"><AtalhosHome /></div>

          {/* Café */}
          <Card className="mb-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[15px] font-semibold text-noite flex items-center gap-2">
                <Icon name="coffee" size={18} /> Caixinha do café
              </h2>
              {salaCafe && cs?.tem_assinatura && (
                cafeAnual
                  ? <Badge variant={cs.pago ? 'success' : 'danger'}>{cs.pago ? 'Anuidade em dia' : 'Anuidade em aberto'}</Badge>
                  : <Badge variant={cs.pago ? 'success' : 'danger'}>{cs.pago ? 'Pago' : 'Pendente'}</Badge>
              )}
            </div>
            {salaCafe && <p className="text-xs text-texto-fraco mt-0.5">{nomeSalaCafe(configPub, salaCafe)}</p>}

            {!salaCafe && (
              <p className="text-sm text-texto-fraco mt-2">A caixinha do café é das salas de oficiais e de graduados, então não há cobrança de café para você.</p>
            )}
            {salaCafe && cs && !cs.tem_assinatura && (
              <p className="text-sm text-texto-fraco mt-2">Você ainda não assinou a caixinha. Procure o responsável da sua sala.</p>
            )}
            {salaCafe && cs?.tem_assinatura && (
              <div className="flex items-end justify-between gap-3 mt-2">
                <div>
                  <div className="font-display text-3xl leading-none text-texto tracking-wide">{brl(cs.valor || 0)}</div>
                  <div className="text-sm text-texto-fraco mt-1">
                    {cafeAnual
                      ? (cs.valido_ate ? `Anuidade válida até ${mesCurto(cs.valido_ate)}` : cs.rotulo || 'Anuidade')
                      : `Referência: ${cs.rotulo || rotuloReferencia({ referencia: cs.mes_atual })}`}
                  </div>
                </div>
                {!cs.pago && (
                  <Link to="/cafe" className="inline-flex items-center justify-center min-h-[44px] px-4 rounded-xl bg-azul text-white text-sm font-medium hover:bg-azul-claro">
                    Pagar café
                  </Link>
                )}
              </div>
            )}
          </Card>

          {/* Histórico recente */}
          <section id="pedidos" className="scroll-mt-24 mb-4">
            <div className="flex items-baseline justify-between gap-3 mb-3 flex-wrap">
              <h2 className="text-[15px] font-semibold text-noite">Pedidos recentes na cantina</h2>
              {data.totais && (
                <span className="text-xs text-texto-fraco">Total gasto: {brl(data.totais.cantina.gasto)}</span>
              )}
            </div>
            {data.ultimos_pedidos.length === 0 ? (
              <Card>
                <EmptyState
                  icon={<Icon name="cart" size={24} />}
                  message="Nenhum pedido ainda"
                  hint="Seus pedidos da cantina aparecem aqui."
                  action={<Link to="/catalogo/oficiais" className="inline-flex items-center min-h-[44px] px-5 rounded-xl bg-azul text-white font-medium hover:bg-azul-claro">Abrir a cantina</Link>}
                />
              </Card>
            ) : (
              <div className="space-y-2.5">
                {data.ultimos_pedidos.map(p => {
                  const st = statusPedido(p.status);
                  return (
                    <Card key={p.id}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-texto-fraco first-letter:uppercase">{formatData(p.created_at)}</span>
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </div>
                      {p.itens && p.itens.length > 0 ? (
                        <ul className="mt-2 space-y-1">
                          {p.itens.map((item, idx) => (
                            <li key={idx} className="flex justify-between gap-3 text-sm">
                              <span className="flex-1 min-w-0 truncate">
                                <span className="text-texto-fraco tabular-nums">{item.quantidade}×</span> {item.nome_produto}
                              </span>
                              <span className="text-texto-fraco tabular-nums">{brl(item.subtotal)}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-texto-fraco mt-2">Sem detalhes</p>
                      )}
                      <div className="flex justify-between items-center mt-2.5 pt-2.5 border-t border-borda">
                        <span className="text-sm text-texto-fraco">Total</span>
                        <span className="font-display text-xl text-texto tracking-wide">{brl(p.total)}</span>
                      </div>
                      {p.status !== 'pago' && (() => {
                        const cs = comprov.get('cantina', p.id);
                        if (cs?.status === 'aguardando' || cs?.status === 'aprovado') {
                          return <div className="mt-3"><StatusComprovante status={cs.status} motivo={cs.motivo_rejeicao} /></div>;
                        }
                        return (
                          <div className="mt-3 space-y-2">
                            {cs?.status === 'rejeitado' && <StatusComprovante status="rejeitado" motivo={cs.motivo_rejeicao} />}
                            <EnviarComprovante origem="cantina" referenciaId={p.id} onEnviado={comprov.recarregar} size="md" />
                          </div>
                        );
                      })()}
                    </Card>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </AppLayout>
  );
}
