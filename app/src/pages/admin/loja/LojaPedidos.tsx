import { useEffect, useState } from 'react';
import { AppLayout } from '../../../components/AppLayout';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Icon } from '../../../components/ui/Icon';
import { api } from '../../../services/api';
import { useConfirm } from '../../../hooks/useConfirm';
import { useToast } from '../../../hooks/useToast';

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

  const carregar = () => {
    const params = filtroStatus ? `?status=${filtroStatus}` : '';
    api.get<LojaPedido[]>(`/api/loja/admin/pedidos${params}`).then(setPedidos);
  };

  useEffect(() => { carregar(); }, [filtroStatus]);

  const marcarPago = async (id: string) => {
    await api.put(`/api/loja/admin/pedidos/${id}/pagar`, {});
    carregar();
  };

  const excluir = async (id: string) => {
    if (!(await confirmar({ title: 'Excluir pedido', message: 'Excluir este pedido?', confirmText: 'Excluir', danger: true }))) return;
    await api.delete(`/api/loja/admin/pedidos/${id}`);
    carregar();
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

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
        <h1 className="font-display text-2xl text-azul tracking-wider">PEDIDOS - LOJA</h1>
        <div className="flex gap-1">
          {['', 'pendente', 'fiado', 'pago'].map((s) => (
            <button key={s} onClick={() => setFiltroStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filtroStatus === s ? 'bg-vermelho text-white' : 'bg-white text-texto-fraco border border-borda hover:text-texto'
              }`}>
              {s || 'Todos'}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl overflow-hidden border border-borda shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-azul">
                <th className="px-3 py-3 text-left text-xs text-white uppercase tracking-wider">Data</th>
                <th className="px-3 py-3 text-left text-xs text-white uppercase tracking-wider">Militar</th>
                <th className="px-3 py-3 text-left text-xs text-white uppercase tracking-wider hidden sm:table-cell">Itens</th>
                <th className="px-3 py-3 text-left text-xs text-white uppercase tracking-wider">Entrega</th>
                <th className="px-3 py-3 text-right text-xs text-white uppercase tracking-wider">Total</th>
                <th className="px-3 py-3 text-center text-xs text-white uppercase tracking-wider">Status</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map((p) => (
                <tr key={p.id} className="border-b border-borda/50 hover:bg-fundo transition-colors">
                  <td className="px-3 py-3 text-xs text-texto-fraco whitespace-nowrap">
                    {new Date(p.created_at + 'Z').toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                  </td>
                  <td className="px-3 py-3 font-medium text-texto">{p.nome_guerra}</td>
                  <td className="px-3 py-3 text-xs text-texto-fraco max-w-[150px] truncate hidden sm:table-cell">{p.itens_resumo}</td>
                  <td className="px-3 py-3 text-xs">
                    {p.entrega_tipo === 'envio' ? (
                      <div className="flex flex-col gap-1 min-w-[140px]">
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-azul border border-blue-200 w-fit">
                          <Icon name="archive" size={12} /> Envio
                        </span>
                        {p.endereco && (
                          <span className="text-texto-fraco max-w-[180px] truncate" title={p.endereco}>{p.endereco}</span>
                        )}
                        <span className="text-texto-fraco">Frete: R$ {(p.frete || 0).toFixed(2)}</span>
                        {p.envio_status === 'enviado' ? (
                          <span className="text-[10px] font-medium text-verde-escuro">
                            Enviado{p.rastreamento ? ` · ${p.rastreamento}` : ''}
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-amber-700">A enviar</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-texto-fraco">Retirada</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right font-bold text-dourado font-display tracking-wide">R$ {p.total.toFixed(2)}</td>
                  <td className="px-3 py-3 text-center">{statusBadge(p.status)}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-col items-start gap-1.5">
                      <div className="flex items-center gap-2">
                        {p.status !== 'pago' && (
                          <Button variant="chip-success" size="xs" onClick={() => marcarPago(p.id)}>Pagar</Button>
                        )}
                        <Button variant="chip-danger" size="xs" onClick={() => excluir(p.id)}>Excluir</Button>
                      </div>
                      {p.entrega_tipo === 'envio' && p.envio_status !== 'enviado' && (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={rastreamentos[p.id] || ''}
                            onChange={e => setRastreamentos(prev => ({ ...prev, [p.id]: e.target.value }))}
                            placeholder="Rastreio (opcional)"
                            className="w-28 bg-white border border-borda rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-azul/30 focus:border-azul"
                          />
                          <Button variant="chip-primary" size="xs" onClick={() => marcarEnviado(p.id)}>Marcar enviado</Button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pedidos.length === 0 && <div className="text-center py-10 text-texto-fraco">Nenhum pedido</div>}
      </div>
    </AppLayout>
  );
}
