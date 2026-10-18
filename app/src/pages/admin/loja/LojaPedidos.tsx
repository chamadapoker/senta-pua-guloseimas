import { useEffect, useState } from 'react';
import { AppLayout } from '../../../components/AppLayout';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Icon } from '../../../components/ui/Icon';
import { api } from '../../../services/api';
import { useConfirm } from '../../../hooks/useConfirm';
import { useToast } from '../../../hooks/useToast';
import { useAcao } from '../../../hooks/useAcao';
import { Loading } from '../../../components/ui/Loading';
import { PageHeader } from '../../../components/ui/PageHeader';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Card } from '../../../components/ui/Card';
import { inputClass } from '../../../components/ui/Field';

const brl = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBR = (s: string) => new Date(s.replace(' ', 'T') + 'Z').toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
const FILTROS: { valor: string; label: string }[] = [
  { valor: '', label: 'Todos' },
  { valor: 'pendente', label: 'Pendentes' },
  { valor: 'fiado', label: 'Fiado' },
  { valor: 'pago', label: 'Pagos' },
];

interface LojaPedido {
  id: string;
  cliente_id: string;
  total: number;
  status: 'pendente' | 'pago' | 'fiado';
  metodo_pagamento: 'pix' | 'fiado';
  created_at: string;
  paid_at: string | null;
  nome_guerra?: string;
  itens_resumo?: string;
  entrega_tipo?: 'retirada' | 'envio';
  endereco?: string | null;
  frete?: number;
  envio_status?: 'a_enviar' | 'enviado' | null;
  rastreamento?: string | null;
}

export function LojaPedidos() {
  const [pedidos, setPedidos] = useState<LojaPedido[]>([]);
  const [filtroStatus, setFiltroStatus] = useState('');
  const [rastreamentos, setRastreamentos] = useState<Record<string, string>>({});
  const confirmar = useConfirm();
  const { showToast } = useToast();
  const { busy, executar } = useAcao();
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const carregar = () => {
    const params = filtroStatus ? `?status=${filtroStatus}` : '';
    setCarregando(true);
    setErro('');
    api.get<LojaPedido[]>(`/api/loja/admin/pedidos${params}`)
      .then(setPedidos)
      .catch((e: any) => setErro(e?.message || 'Erro ao carregar pedidos'))
      .finally(() => setCarregando(false));
  };

  useEffect(() => { carregar(); }, [filtroStatus]);

  const marcarPago = async (id: string) => {
    const ok = await executar(`pagar:${id}`, () => api.put(`/api/loja/admin/pedidos/${id}/pagar`, {}), { sucesso: 'Pedido marcado como pago' });
    if (ok !== undefined) carregar();
  };

  const excluir = async (id: string) => {
    if (!(await confirmar({ title: 'Excluir pedido', message: 'Excluir este pedido?', confirmText: 'Excluir', danger: true }))) return;
    const ok = await executar(`excluir:${id}`, () => api.delete(`/api/loja/admin/pedidos/${id}`));
    if (ok !== undefined) carregar();
  };

  const marcarEnviado = async (id: string) => {
    try {
      const rastreamento = rastreamentos[id]?.trim() || undefined;
      await api.put(`/api/loja/admin/pedidos/${id}/enviar`, { rastreamento });
      showToast('Pedido marcado como enviado', 'success');
      setRastreamentos(prev => { const n = { ...prev }; delete n[id]; return n; });
      carregar();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao marcar como enviado', 'error');
    }
  };

  const statusBadge = (status: string) => {
    if (status === 'pago') return <Badge variant="success">Pago</Badge>;
    if (status === 'fiado') return <Badge variant="danger">Fiado</Badge>;
    return <Badge variant="warning">Pendente</Badge>;
  };

  const entrega = (p: LojaPedido) => p.entrega_tipo === 'envio' ? (
    <div className="flex flex-col gap-1 min-w-0">
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-azul border border-blue-200 w-fit">
        <Icon name="archive" size={12} /> Envio
      </span>
      {p.endereco && <span className="text-xs text-texto-fraco break-words" title={p.endereco}>{p.endereco}</span>}
      <span className="text-xs text-texto-fraco">Frete: {brl(p.frete || 0)}</span>
      {p.envio_status === 'enviado' ? (
        <span className="text-xs font-medium text-verde-escuro break-all">Enviado{p.rastreamento ? ` · ${p.rastreamento}` : ''}</span>
      ) : (
        <span className="text-xs font-medium text-amber-700">A enviar</span>
      )}
    </div>
  ) : (
    <span className="text-xs text-texto-fraco">Retirada</span>
  );

  const acoes = (p: LojaPedido) => (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        {p.status !== 'pago' && (
          <Button variant="chip-success" size="sm" onClick={() => marcarPago(p.id)} disabled={busy(`pagar:${p.id}`)}>
            <Icon name="check" size={15} /> {busy(`pagar:${p.id}`) ? 'Salvando...' : 'Marcar pago'}
          </Button>
        )}
        <Button variant="chip-danger" size="sm" onClick={() => excluir(p.id)} disabled={busy(`excluir:${p.id}`)}>
          <Icon name="trash" size={15} /> Excluir
        </Button>
      </div>
      {p.entrega_tipo === 'envio' && p.envio_status !== 'enviado' && (
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="text"
            aria-label={`Código de rastreio do pedido de ${p.nome_guerra || 'militar'}`}
            value={rastreamentos[p.id] || ''}
            onChange={e => setRastreamentos(prev => ({ ...prev, [p.id]: e.target.value }))}
            placeholder="Rastreio (opcional)"
            className={`${inputClass} !w-auto flex-1 min-w-[8rem] !py-2`}
          />
          <Button variant="chip-primary" size="sm" onClick={() => marcarEnviado(p.id)}>Marcar enviado</Button>
        </div>
      )}
    </div>
  );

  return (
    <AppLayout>
      <PageHeader title="Pedidos da loja" subtitle="Confirme pagamentos e registre os envios dos pedidos." />

      <div className="flex flex-wrap gap-2 mb-4" role="group" aria-label="Filtrar por status">
        {FILTROS.map((f) => (
          <Button key={f.valor} size="sm" variant={filtroStatus === f.valor ? 'primary' : 'chip'}
            aria-pressed={filtroStatus === f.valor} onClick={() => setFiltroStatus(f.valor)}>
            {f.label}
          </Button>
        ))}
      </div>

      {erro ? (
        <Card className="text-center py-10">
          <p className="text-escarlate text-sm mb-4">{erro}</p>
          <Button size="sm" onClick={carregar}><Icon name="refresh" size={16} /> Tentar de novo</Button>
        </Card>
      ) : carregando && pedidos.length === 0 ? (
        <Loading label="Carregando pedidos..." />
      ) : pedidos.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Icon name="bag" size={24} />}
            message={filtroStatus ? 'Nenhum pedido com este status' : 'Nenhum pedido ainda'}
            hint={filtroStatus ? 'Troque o filtro para ver os outros pedidos.' : 'Os pedidos feitos na loja aparecem aqui.'}
            action={filtroStatus ? <Button variant="ghost" size="sm" onClick={() => setFiltroStatus('')}>Ver todos</Button> : undefined}
          />
        </Card>
      ) : (
        <>
          {/* Celular: cartões */}
          <div className="md:hidden space-y-3">
            {pedidos.map((p) => (
              <Card key={p.id}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <div className="font-medium text-noite truncate">{p.nome_guerra}</div>
                    <div className="text-xs text-texto-fraco">{dataBR(p.created_at)}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-display text-xl text-dourado tracking-wide leading-none">{brl(p.total)}</div>
                    <div className="mt-1">{statusBadge(p.status)}</div>
                  </div>
                </div>
                {p.itens_resumo && <p className="text-sm text-texto-fraco mb-2 break-words">{p.itens_resumo}</p>}
                <div className="mb-3">{entrega(p)}</div>
                {acoes(p)}
              </Card>
            ))}
          </div>

          {/* Desktop: tabela */}
          <div className="hidden md:block bg-white rounded-2xl overflow-hidden border border-borda shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-noite text-left">
                  <th className="px-4 py-3 text-xs font-medium text-white">Data</th>
                  <th className="px-4 py-3 text-xs font-medium text-white">Militar</th>
                  <th className="px-4 py-3 text-xs font-medium text-white">Itens</th>
                  <th className="px-4 py-3 text-xs font-medium text-white">Entrega</th>
                  <th className="px-4 py-3 text-xs font-medium text-white text-right">Total</th>
                  <th className="px-4 py-3 text-xs font-medium text-white text-center">Status</th>
                  <th className="px-4 py-3"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {pedidos.map((p) => (
                  <tr key={p.id} className="border-b border-borda/50 last:border-0 hover:bg-fundo align-top">
                    <td className="px-4 py-3 text-xs text-texto-fraco whitespace-nowrap">{dataBR(p.created_at)}</td>
                    <td className="px-4 py-3 font-medium text-texto">{p.nome_guerra}</td>
                    <td className="px-4 py-3 text-xs text-texto-fraco max-w-[200px]"><span className="line-clamp-2" title={p.itens_resumo}>{p.itens_resumo}</span></td>
                    <td className="px-4 py-3 max-w-[220px]">{entrega(p)}</td>
                    <td className="px-4 py-3 text-right font-display text-lg text-dourado tracking-wide whitespace-nowrap">{brl(p.total)}</td>
                    <td className="px-4 py-3 text-center">{statusBadge(p.status)}</td>
                    <td className="px-4 py-3">{acoes(p)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </AppLayout>
  );
}
