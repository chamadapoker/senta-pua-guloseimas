import { useEffect, useState } from 'react';
import { AppLayout } from '../../../components/AppLayout';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { api } from '../../../services/api';

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
}

export function LojaPedidos() {
  const [pedidos, setPedidos] = useState<LojaPedido[]>([]);
  const [filtroStatus, setFiltroStatus] = useState('');

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
    if (!window.confirm('Excluir este pedido?')) return;
    await api.delete(`/api/loja/admin/pedidos/${id}`);
    carregar();
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
                  <td className="px-3 py-3 text-right font-bold text-dourado font-display tracking-wide">R$ {p.total.toFixed(2)}</td>
                  <td className="px-3 py-3 text-center">{statusBadge(p.status)}</td>
                  <td className="px-3 py-3 flex items-center gap-2">
                    {p.status !== 'pago' && (
                      <button onClick={() => marcarPago(p.id)} className="text-verde text-xs hover:underline">Pagar</button>
                    )}
                    <button onClick={() => excluir(p.id)} className="text-vermelho text-xs hover:underline">Excluir</button>
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
