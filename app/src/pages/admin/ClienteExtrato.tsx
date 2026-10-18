import { useEffect, useState, type ReactNode } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { BackButton } from '../../components/ui/BackButton';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Icon } from '../../components/ui/Icon';
import { api } from '../../services/api';
import { useConfirm } from '../../hooks/useConfirm';
import { useAcao } from '../../hooks/useAcao';
import { Loading } from '../../components/ui/Loading';
import { montarLinkCobranca } from '../../services/whatsapp';
import { gerarExtratoUnificadoPDF } from '../../services/pdf';
import { PeriodoFiltro, usePeriodoUrl } from '../../components/admin/PeriodoFiltro';
import { dataLocalDoBanco, descreverPeriodo, mesNoPeriodo, noPeriodo, periodoAtivo, periodoParaQuery } from '../../services/periodo';
import type { Cliente, Pedido } from '../../types';

interface CafePagamento { id: string; referencia: string; valor: number; status: string; cafe_tipo: string; cafe_plano: string; }
interface XimbocaPart { id: string; nome: string; status: string; evento_nome: string; evento_data: string; valor_por_pessoa: number; valor_individual: number | null; }
interface LojaPedido { id: string; total: number; status: string; created_at: string; itens_resumo?: string; parcelas: number; }

interface ExtratoCompleto {
  cliente: Cliente;
  guloseimas: Pedido[];
  loja: LojaPedido[];
  cafe: CafePagamento[];
  ximboca: XimbocaPart[];
}

const brl = (v: number) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBanco = (d: string) => new Date(d.replace(' ', 'T') + 'Z').toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
const dataEvento = (d: string) => new Date(d.slice(0, 10) + 'T12:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
const refMes = (ref: string) => {
  const [a, m] = ref.split('-');
  return a && m ? `${m}/${a}` : ref;
};

function Lancamento({ topo, meio, valor, acao, destaque }: { topo: ReactNode; meio?: ReactNode; valor: number; acao?: ReactNode; destaque?: boolean }) {
  return (
  <li className={`bg-white rounded-2xl p-4 border shadow-sm ${destaque ? 'border-amber-300' : 'border-borda'}`}>
    <div className="flex items-start justify-between gap-2 mb-2">{topo}</div>
    {meio && <div className="text-sm text-texto-fraco mb-3 break-words">{meio}</div>}
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <span className="font-display text-2xl leading-none tracking-wide text-dourado">{brl(valor)}</span>
      {acao}
    </div>
  </li>
);
}

type Aba = 'guloseimas' | 'loja' | 'cafe' | 'ximboca';

export function ClienteExtrato() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<ExtratoCompleto | null>(null);
  const [erro, setErro] = useState(false);
  const [aba, setAba] = useState<Aba>('guloseimas');
  const [periodo, setPeriodo] = usePeriodoUrl();
  const confirmar = useConfirm();
  const { busy, executar } = useAcao();

  const carregar = async () => {
    if (!id) return;
    try {
      const d = await api.get<ExtratoCompleto>(`/api/clientes/${id}/extrato-completo`);
      setData(d);
      setErro(false);
    } catch {
      setErro(true);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { carregar(); }, [id]);

  const marcarPagoGuloseimas = async (pedidoId: string) => {
    const ok = await executar(`pagar:${pedidoId}`, () => api.put(`/api/pedidos/${pedidoId}/pagar`, {}), { sucesso: 'Marcado como pago' });
    if (ok !== undefined) carregar();
  };

  const marcarPagoLoja = async (pedidoId: string) => {
    const ok = await executar(`pagar:${pedidoId}`, () => api.put(`/api/loja/admin/pedidos/${pedidoId}/pagar`, {}), { sucesso: 'Marcado como pago' });
    if (ok !== undefined) carregar();
  };

  const marcarPagoCafe = async (pagId: string) => {
    const ok = await executar(`pagar:${pagId}`, () => api.put(`/api/cafe/admin/mensalidades/${pagId}/pagar`, {}), { sucesso: 'Marcado como pago' });
    if (ok !== undefined) carregar();
  };

  const voltar = <BackButton to={`/admin/clientes${periodoParaQuery(periodo)}`} className="mb-3" />;

  if (erro && !data) {
    return (
      <AppLayout>
        {voltar}
        <Card size="lg" className="text-center">
          <p className="text-[15px] font-medium text-texto">Não foi possível carregar o extrato deste militar.</p>
          <p className="text-sm text-texto-fraco mt-1">Verifique a conexão e tente de novo.</p>
          <Button variant="primary" size="sm" className="mt-4" onClick={() => { setErro(false); carregar(); }}>
            <Icon name="refresh" size={16} /> Tentar de novo
          </Button>
        </Card>
      </AppLayout>
    );
  }
  if (!data) return <AppLayout>{voltar}<Loading label="Carregando extrato..." /></AppLayout>;

  const { cliente } = data;
  // Lançamentos dentro do período escolhido; totais, abas e PDF usam só estes
  const guloseimas = data.guloseimas.filter(p => noPeriodo(dataLocalDoBanco(p.created_at), periodo));
  const loja = data.loja.filter(p => noPeriodo(dataLocalDoBanco(p.created_at), periodo));
  const cafe = data.cafe.filter(p => mesNoPeriodo(p.referencia, periodo));
  const ximboca = data.ximboca.filter(p => noPeriodo(p.evento_data.slice(0, 10), periodo));

  const devidoGuloseimas = guloseimas.filter(p => p.status !== 'pago').reduce((s, p) => s + p.total, 0);
  const devidoLoja = loja.filter(p => p.status !== 'pago').reduce((s, p) => s + p.total, 0);
  const devidoCafe = cafe.filter(p => p.status === 'pendente').reduce((s, p) => s + p.valor, 0);
  const devidoXimboca = ximboca.filter(p => p.status !== 'pago').reduce((s, p) => s + (p.valor_individual ?? p.valor_por_pessoa), 0);
  const totalDevido = devidoGuloseimas + devidoLoja + devidoCafe + devidoXimboca;

  const handlePdfWhatsapp = async () => {
    const fmt = (d: string) => new Date(d + 'Z').toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const cafeGraduado = cafe.some(p => p.cafe_tipo === 'graduado');
    await gerarExtratoUnificadoPDF(cliente.nome_guerra, {
      guloseimas: guloseimas.filter(p => p.status !== 'pago').map(p => ({ itens: p.itens_resumo || '-', valor: p.total, data: fmt(p.created_at) })),
      loja: loja.filter(p => p.status !== 'pago').map(p => ({ itens: p.itens_resumo || '-', valor: p.total, data: fmt(p.created_at), parcelas: p.parcelas })),
      cafe: cafe.filter(p => p.status === 'pendente').map(p => ({ referencia: p.referencia, valor: p.valor, tipo: `${p.cafe_tipo} - ${p.cafe_plano}` })),
      ximboca: ximboca.filter(p => p.status !== 'pago').map(p => ({ evento: p.evento_nome, data: new Date(p.evento_data + 'T12:00:00').toLocaleDateString('pt-BR'), valor: p.valor_individual ?? p.valor_por_pessoa })),
    }, totalDevido, cafeGraduado);
    window.open(montarLinkCobranca(cliente.nome_guerra, totalDevido), '_blank');
  };

  const alternarBloqueio = async () => {
    const acao = cliente.ativo ? 'bloquear' : 'desbloquear';
    if (!(await confirmar({
      title: 'Confirmar',
      message: `Tem certeza que deseja ${acao} ${cliente.nome_guerra}?`,
      confirmText: acao.charAt(0).toUpperCase() + acao.slice(1),
      danger: !!cliente.ativo,
    }))) return;
    const ok = await executar('bloqueio', () => api.put(`/api/clientes/${cliente.id}/bloquear`, { ativo: cliente.ativo ? 0 : 1 }));
    if (ok !== undefined) carregar();
  };

  const statusBadge = (status: string) => {
    if (status === 'pago') return <Badge variant="success">Pago</Badge>;
    if (status === 'fiado') return <Badge variant="danger">Fiado</Badge>;
    return <Badge variant="warning">Pendente</Badge>;
  };

  const abas = [
    { id: 'guloseimas' as const, label: 'Cantina', count: guloseimas.filter(p => p.status !== 'pago').length, valor: devidoGuloseimas },
    { id: 'loja' as const, label: 'Loja', count: loja.filter(p => p.status !== 'pago').length, valor: devidoLoja },
    { id: 'cafe' as const, label: 'Café', count: cafe.filter(p => p.status === 'pendente').length, valor: devidoCafe },
    { id: 'ximboca' as const, label: 'Ximboca', count: ximboca.filter(p => p.status !== 'pago').length, valor: devidoXimboca },
  ];

  const botaoPagar = (chave: string, onClick: () => void) => (
    <Button size="sm" variant="chip-success" onClick={onClick} disabled={busy(`pagar:${chave}`)}>
      <Icon name="check" size={16} />
      {busy(`pagar:${chave}`) ? 'Salvando...' : 'Marcar como pago'}
    </Button>
  );

  const vazio = (msg: string) => (
    <Card>
      <EmptyState
        icon={<Icon name="document" size={26} />}
        message={msg}
        hint={periodoAtivo(periodo) ? 'Amplie o período para ver lançamentos mais antigos.' : undefined}
      />
    </Card>
  );

  return (
    <AppLayout>
      {voltar}

      {/* Cabeçalho do militar */}
      <Card size="lg" className="mb-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <div
              className="w-16 h-16 rounded-2xl bg-noite flex items-center justify-center text-white font-display text-2xl tracking-wider shrink-0"
              aria-hidden="true"
            >
              {cliente.nome_guerra.slice(0, 3).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-[1.75rem] sm:text-3xl leading-none text-noite tracking-wide truncate">{cliente.nome_guerra}</h1>
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                {cliente.ativo ? <Badge variant="success">Ativo</Badge> : <Badge variant="danger">Bloqueado</Badge>}
                {totalDevido > 0 ? <Badge variant="danger">Com dívida</Badge> : <Badge variant="neutral">Em dia</Badge>}
                {cliente.visitante ? (
                  <span className="text-xs text-azul font-medium bg-azul/10 px-2 py-0.5 rounded-full">
                    Visitante{cliente.esquadrao_origem ? ` · ${cliente.esquadrao_origem}` : ''}
                  </span>
                ) : null}
                {cliente.saram && <span className="text-xs text-texto-fraco font-mono">SARAM {cliente.saram}</span>}
              </div>
            </div>
          </div>
          <div className="sm:text-right sm:border-l sm:border-borda sm:pl-5 pt-3 sm:pt-0 border-t border-borda sm:border-t-0">
            <div className="text-sm text-texto-fraco">Total pendente{periodoAtivo(periodo) ? ' no período' : ''}</div>
            <div className={`font-display text-4xl leading-none tracking-wide mt-1 ${totalDevido > 0 ? 'text-escarlate' : 'text-verde'}`}>
              {brl(totalDevido)}
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-5 flex-wrap">
          {totalDevido > 0 && (
            <Button variant="primary" size="sm" onClick={handlePdfWhatsapp}>
              <Icon name="document" size={16} /> Gerar PDF e cobrar no WhatsApp
            </Button>
          )}
          <Button variant={cliente.ativo ? 'chip-warning' : 'chip-success'} size="sm" onClick={alternarBloqueio} disabled={busy('bloqueio')}>
            {cliente.ativo ? 'Bloquear militar' : 'Desbloquear militar'}
          </Button>
          <Link
            to={`/admin/usuarios?trigrama=${encodeURIComponent(cliente.nome_guerra)}`}
            className="inline-flex items-center gap-2 min-h-[40px] px-3.5 rounded-xl text-sm font-medium text-azul hover:bg-blue-50"
          >
            <Icon name="user" size={16} /> Gerenciar conta de usuário
          </Link>
        </div>
      </Card>

      <PeriodoFiltro periodo={periodo} onChange={setPeriodo} className="mb-2" />
      <p className="text-xs text-texto-fraco mb-4">
        Mostrando lançamentos de <strong>{descreverPeriodo(periodo)}</strong>
        {periodoAtivo(periodo) && '. O PDF de cobrança também sai só deste período'}.
        {' '}Café entra pelo mês de referência; Ximboca pela data do evento.
      </p>

      {/* Abas: também mostram quanto está pendente em cada uma */}
      <div role="tablist" aria-label="Tipo de lançamento" className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        {abas.map(a => {
          const ativa = aba === a.id;
          return (
            <button
              key={a.id}
              role="tab"
              aria-selected={ativa}
              onClick={() => setAba(a.id)}
              className={`text-left rounded-xl px-3.5 py-2.5 min-h-[56px] border transition-colors outline-none focus-visible:ring-2 focus-visible:ring-azul/40 ${
                ativa ? 'bg-azul border-azul text-white' : 'bg-white border-borda text-texto hover:bg-fundo-elevado'
              }`}
            >
              <span className="flex items-center justify-between gap-2 text-sm font-medium">
                {a.label}
                {a.count > 0 && (
                  <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${ativa ? 'bg-white/20 text-white' : 'bg-red-50 text-escarlate'}`}>
                    {a.count}
                  </span>
                )}
              </span>
              <span className={`block text-xs mt-0.5 ${ativa ? 'text-white/80' : a.valor > 0 ? 'text-escarlate' : 'text-texto-fraco'}`}>
                {a.valor > 0 ? `${brl(a.valor)} pendente` : 'Nada pendente'}
              </span>
            </button>
          );
        })}
      </div>

      {aba === 'guloseimas' && (guloseimas.length === 0 ? vazio('Nenhum pedido na cantina') : (
        <ul className="space-y-3">
          {guloseimas.map(p => (
            <Lancamento
              key={p.id}
              topo={<><span className="text-sm text-texto-fraco">{dataBanco(p.created_at)}</span>{statusBadge(p.status)}</>}
              meio={p.itens_resumo || '-'}
              valor={p.total}
              acao={p.status !== 'pago' ? botaoPagar(p.id, () => marcarPagoGuloseimas(p.id)) : undefined}
            />
          ))}
        </ul>
      ))}

      {aba === 'loja' && (loja.length === 0 ? vazio('Nenhum pedido na loja') : (
        <ul className="space-y-3">
          {loja.map(p => (
            <Lancamento
              key={p.id}
              topo={<>
                <span className="text-sm text-texto-fraco">{dataBanco(p.created_at)}</span>
                <span className="flex items-center gap-2">
                  {p.parcelas > 1 && <span className="text-xs text-azul bg-azul/10 px-2 py-0.5 rounded-full">{p.parcelas}x</span>}
                  {statusBadge(p.status)}
                </span>
              </>}
              meio={p.itens_resumo || '-'}
              valor={p.total}
              acao={p.status !== 'pago' ? botaoPagar(p.id, () => marcarPagoLoja(p.id)) : undefined}
            />
          ))}
        </ul>
      ))}

      {aba === 'cafe' && (cafe.length === 0 ? vazio('Nenhuma mensalidade de café') : (
        <ul className="space-y-3">
          {cafe.map(p => (
            <Lancamento
              key={p.id}
              destaque={p.cafe_plano === 'anual'}
              topo={<>
                <span className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-texto">Referência {refMes(p.referencia)}</span>
                  <span className="text-xs text-texto-fraco bg-fundo px-2 py-0.5 rounded-full capitalize">{p.cafe_tipo} · {p.cafe_plano}</span>
                </span>
                {statusBadge(p.status)}
              </>}
              valor={p.valor}
              acao={p.status === 'pendente' ? botaoPagar(p.id, () => marcarPagoCafe(p.id)) : undefined}
            />
          ))}
        </ul>
      ))}

      {aba === 'ximboca' && (ximboca.length === 0 ? vazio('Nenhuma participação em Ximboca') : (
        <ul className="space-y-3">
          {ximboca.map(p => (
            <Lancamento
              key={p.id}
              topo={<>
                <span className="min-w-0">
                  <span className="block font-medium text-texto text-sm">{p.evento_nome}</span>
                  <span className="block text-xs text-texto-fraco">{dataEvento(p.evento_data)}</span>
                </span>
                {statusBadge(p.status)}
              </>}
              valor={p.valor_individual ?? p.valor_por_pessoa}
            />
          ))}
        </ul>
      ))}
    </AppLayout>
  );
}
