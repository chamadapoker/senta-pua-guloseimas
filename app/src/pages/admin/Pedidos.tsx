import { useEffect, useState } from 'react';
import { AdminLayout } from '../../components/Layout';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { api } from '../../services/api';
import type { Pedido } from '../../types';

export function Pedidos() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [filtroStatus, setFiltroStatus] = useState('');
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  const carregar = () => {
    const params = filtroStatus ? `?status=${filtroStatus}` : '';
    api.get<Pedido[]>(`/api/pedidos${params}`).then(setPedidos);
  };

  useEffect(() => { carregar(); }, [filtroStatus]);

  const marcarPago = async (pedidoId: string) => {
    await api.put(`/api/pedidos/${pedidoId}/pagar`, {});
    carregar();
  };

  const marcarLotePago = async () => {
    for (const id of selecionados) {
      await api.put(`/api/pedidos/${id}/pagar`, {});
    }
    setSelecionados(new Set());
    carregar();
  };

  const excluirPedido = async (pedidoId: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este pedido? Essa ação não pode ser desfeita.')) return;
    try {
      await api.delete(`/api/pedidos/${pedidoId}`);
      carregar();
    } catch (e) {
      alert('Erro ao excluir: ' + (e instanceof Error ? e.message : 'tente novamente'));
    }
  };

  const toggleSelecionado = (id: string) => {
    const novo = new Set(selecionados);
    if (novo.has(id)) novo.delete(id); else novo.add(id);
    setSelecionados(novo);
  };

  const statusBadge = (status: string) => {
    if (status === 'pago') return <Badge variant="success">Pago</Badge>;
    if (status === 'fiado') return <Badge variant="danger">Fiado</Badge>;
    return <Badge variant="warning">Pendente</Badge>;
  };

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display text-2xl text-azul tracking-wider">PEDIDOS</h1>
        <div className="flex gap-1">
          {['', 'pendente', 'fiado', 'pago'].map((s) => (
            <button
              key={s}
              onClick={() => setFiltroStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filtroStatus === s ? 'bg-vermelho text-white' : 'bg-white text-texto-fraco border border-borda hover:text-texto'
              }`}
            >
              {s || 'Todos'}
            </button>
          ))}
        </div>
      </div>

      {selecionados.size > 0 && (
        <div className="bg-azul rounded-xl p-3 mb-4 flex items-center justify-between border border-azul-claro/30">
          <span className="text-white text-sm">{selecionados.size} selecionado(s)</span>
          <Button size="sm" variant="danger" onClick={marcarLotePago}>Marcar como pago</Button>
        </div>
      )}

      <div className="bg-white rounded-xl overflow-hidden border border-borda shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-azul">
                <th className="px-3 py-3 w-8"></th>
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
                  <td className="px-3 py-3">
                    {p.status !== 'pago' && (
                      <input
                        type="checkbox"
                        checked={selecionados.has(p.id)}
                        onChange={() => toggleSelecionado(p.id)}
                        className="accent-vermelho"
                      />
                    )}
                  </td>
                  <td className="px-3 py-3 text-xs text-texto-fraco whitespace-nowrap">
                    {new Date(p.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-3 py-3 font-medium text-texto">{p.nome_guerra}</td>
                  <td className="px-3 py-3 text-xs text-texto-fraco max-w-[150px] truncate hidden sm:table-cell">
                    {p.itens_resumo}
                  </td>
                  <td className="px-3 py-3 text-right font-bold text-dourado font-display tracking-wide">R$ {p.total.toFixed(2)}</td>
                  <td className="px-3 py-3 text-center">{statusBadge(p.status)}</td>
                  <td className="px-3 py-3 flex items-center gap-2">
                    {p.status !== 'pago' && (
                      <button onClick={() => marcarPago(p.id)} className="text-verde text-xs hover:underline">
                        Pagar
                      </button>
                    )}
                    <button onClick={() => excluirPedido(p.id)} className="text-vermelho text-xs hover:underline">
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pedidos.length === 0 && (
          <div className="text-center py-10 text-texto-fraco">Nenhum pedido</div>
        )}
      </div>
    </AdminLayout>
  );
}
