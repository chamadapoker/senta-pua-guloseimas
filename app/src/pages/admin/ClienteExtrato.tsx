import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { api } from '../../services/api';
import { montarLinkCobranca } from '../../services/whatsapp';
import { gerarExtratoUnificadoPDF } from '../../services/pdf';
import { Link } from 'react-router-dom';
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

export function ClienteExtrato() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<ExtratoCompleto | null>(null);
  const [aba, setAba] = useState<'guloseimas' | 'loja' | 'cafe' | 'ximboca'>('guloseimas');

  const carregar = async () => {
    if (!id) return;
    const d = await api.get<ExtratoCompleto>(`/api/clientes/${id}/extrato-completo`);
    setData(d);
  };

  useEffect(() => { carregar(); }, [id]);

  const marcarPagoGuloseimas = async (pedidoId: string) => {
    await api.put(`/api/pedidos/${pedidoId}/pagar`, {});
    carregar();
  };

  const marcarPagoLoja = async (pedidoId: string) => {
    await api.put(`/api/loja/admin/pedidos/${pedidoId}/pagar`, {});
    carregar();
  };

  const marcarPagoCafe = async (pagId: string) => {
    await api.put(`/api/cafe/admin/mensalidades/${pagId}/pagar`, {});
    carregar();
  };

  if (!data) return <AppLayout><div className="text-center py-10 text-texto-fraco">Carregando...</div></AppLayout>;

  const { cliente, guloseimas, loja, cafe, ximboca } = data;

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

  const statusBadge = (status: string) => {
    if (status === 'pago') return <Badge variant="success">Pago</Badge>;
    if (status === 'fiado') return <Badge variant="danger">Fiado</Badge>;
    return <Badge variant="warning">Pendente</Badge>;
  };

  const abas = [
    { id: 'guloseimas' as const, label: 'Cantina', count: guloseimas.filter(p => p.status !== 'pago').length, valor: devidoGuloseimas },
    { id: 'loja' as const, label: 'Loja', count: loja.filter(p => p.status !== 'pago').length, valor: devidoLoja },
    { id: 'cafe' as const, label: 'Cafe', count: cafe.filter(p => p.status === 'pendente').length, valor: devidoCafe },
    { id: 'ximboca' as const, label: 'Ximboca', count: ximboca.filter(p => p.status !== 'pago').length, valor: devidoXimboca },
  ];

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex items-center gap-4 mb-4">
        <div className="w-14 h-14 rounded-full bg-azul flex items-center justify-center text-white font-display text-xl tracking-wider">
          {cliente.nome_guerra.slice(0, 2)}
        </div>
        <div>
          <h1 className="font-display text-xl text-texto tracking-wider">
            {cliente.nome_guerra}
            {!cliente.ativo && <span className="ml-2 text-sm text-vermelho">BLOQUEADO</span>}
            {cliente.visitante ? <span className="ml-2 text-[10px] text-azul bg-azul/10 px-1.5 py-0.5 rounded">VISITANTE{cliente.esquadrao_origem ? ` - ${cliente.esquadrao_origem}` : ''}</span> : null}
          </h1>
          {totalDevido > 0 && (
            <span className="text-vermelho font-bold font-display tracking-wide">Total pendente: R$ {totalDevido.toFixed(2)}</span>
          )}
        </div>
      </div>

      {/* Link conta de usuario */}
      <div className="mb-5">
        <Link
          to={`/admin/usuarios?trigrama=${encodeURIComponent(cliente.nome_guerra)}`}
          className="inline-flex items-center gap-2 text-sm text-azul hover:underline"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
          </svg>
          Gerenciar conta de usuário →
        </Link>
      </div>

      {/* Summary cards */}
      {totalDevido > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
          {abas.filter(a => a.valor > 0).map(a => (
            <div key={a.id} className="bg-white rounded-lg p-3 border border-borda text-center">
              <div className="text-[10px] text-texto-fraco uppercase">{a.label}</div>
              <div className="font-display text-sm text-vermelho font-bold">R$ {a.valor.toFixed(2)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {totalDevido > 0 && (
          <Button variant="danger" size="sm" onClick={handlePdfWhatsapp}>
            Gerar PDF + WhatsApp
          </Button>
        )}
        <Button
          variant={cliente.ativo ? 'outline' : 'success'}
          size="sm"
          onClick={async () => {
            const acao = cliente.ativo ? 'bloquear' : 'desbloquear';
            if (!window.confirm(`Tem certeza que deseja ${acao} ${cliente.nome_guerra}?`)) return;
            await api.put(`/api/clientes/${cliente.id}/bloquear`, { ativo: cliente.ativo ? 0 : 1 });
            carregar();
          }}
        >
          {cliente.ativo ? 'Bloquear militar' : 'Desbloquear militar'}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto">
        {abas.map(a => (
          <button key={a.id} onClick={() => setAba(a.id)}
            className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              aba === a.id ? 'bg-azul text-white' : 'bg-white text-texto-fraco border border-borda'
            }`}>
            {a.label} {a.count > 0 && <span className="ml-1 bg-vermelho/20 text-vermelho px-1.5 py-0.5 rounded-full text-[10px]">{a.count}</span>}
          </button>
        ))}
      </div>

      {/* Guloseimas tab */}
      {aba === 'guloseimas' && (
        <div className="space-y-3">
          {guloseimas.map(p => (
            <div key={p.id} className="bg-white rounded-xl p-4 border border-borda shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-texto-fraco">{new Date(p.created_at + 'Z').toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</span>
                {statusBadge(p.status)}
              </div>
              <div className="text-sm text-texto-fraco mb-2">{p.itens_resumo || '-'}</div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-dourado font-display tracking-wide">R$ {p.total.toFixed(2)}</span>
                {p.status !== 'pago' && <Button size="sm" variant="outline" onClick={() => marcarPagoGuloseimas(p.id)}>Marcar pago</Button>}
              </div>
            </div>
          ))}
          {guloseimas.length === 0 && <div className="text-center py-10 text-texto-fraco">Nenhum pedido</div>}
        </div>
      )}

      {/* Loja tab */}
      {aba === 'loja' && (
        <div className="space-y-3">
          {loja.map(p => (
            <div key={p.id} className="bg-white rounded-xl p-4 border border-borda shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-texto-fraco">{new Date(p.created_at + 'Z').toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</span>
                <div className="flex items-center gap-2">
                  {p.parcelas > 1 && <span className="text-[10px] text-azul bg-azul/10 px-1.5 py-0.5 rounded">{p.parcelas}x</span>}
                  {statusBadge(p.status)}
                </div>
              </div>
              <div className="text-sm text-texto-fraco mb-2">{p.itens_resumo || '-'}</div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-dourado font-display tracking-wide">R$ {p.total.toFixed(2)}</span>
                {p.status !== 'pago' && <Button size="sm" variant="outline" onClick={() => marcarPagoLoja(p.id)}>Marcar pago</Button>}
              </div>
            </div>
          ))}
          {loja.length === 0 && <div className="text-center py-10 text-texto-fraco">Nenhum pedido na loja</div>}
        </div>
      )}

      {/* Cafe tab */}
      {aba === 'cafe' && (
        <div className="space-y-3">
          {cafe.map(p => (
            <div key={p.id} className={`bg-white rounded-xl p-4 border shadow-sm ${p.cafe_plano === 'anual' ? 'border-amber-400' : 'border-borda'}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-texto-fraco">Ref: {p.referencia}</span>
                  <span className="text-[10px] text-texto-fraco bg-fundo px-1.5 py-0.5 rounded capitalize">{p.cafe_tipo} - {p.cafe_plano}</span>
                </div>
                {statusBadge(p.status)}
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-dourado font-display tracking-wide">R$ {p.valor.toFixed(2)}</span>
                {p.status === 'pendente' && <Button size="sm" variant="outline" onClick={() => marcarPagoCafe(p.id)}>Marcar pago</Button>}
              </div>
            </div>
          ))}
          {cafe.length === 0 && <div className="text-center py-10 text-texto-fraco">Nenhuma mensalidade</div>}
        </div>
      )}

      {/* Ximboca tab */}
      {aba === 'ximboca' && (
        <div className="space-y-3">
          {ximboca.map(p => (
            <div key={p.id} className="bg-white rounded-xl p-4 border border-borda shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="font-medium text-texto text-sm">{p.evento_nome}</span>
                  <span className="text-xs text-texto-fraco ml-2">{new Date(p.evento_data + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                </div>
                {statusBadge(p.status)}
              </div>
              <span className="font-bold text-dourado font-display tracking-wide">R$ {(p.valor_individual ?? p.valor_por_pessoa).toFixed(2)}</span>
            </div>
          ))}
          {ximboca.length === 0 && <div className="text-center py-10 text-texto-fraco">Nenhuma participacao</div>}
        </div>
      )}
    </AppLayout>
  );
}
