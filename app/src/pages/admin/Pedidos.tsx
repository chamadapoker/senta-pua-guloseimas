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
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-azul">Pedidos</h1>
        <div className="flex gap-1">
          {['', 'pendente', 'fiado', 'pago'].map((s) => (
            <button
              key={s}
              onClick={() => setFiltroStatus(s)}
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                filtroStatus === s ? 'bg-azul text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {s || 'Todos'}
            </button>
          ))}
        </div>
      </div>

      {selecionados.size > 0 && (
        <div className="bg-azul text-white rounded-lg p-3 mb-3 flex items-center justify-between">
          <span>{selecionados.size} selecionado(s)</span>
          <Button size="sm" variant="danger" onClick={marcarLotePago}>Marcar como pago</Button>
        </div>
      )}

      <div className="bg-white rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 w-8"></th>
              <th className="px-3 py-2 text-left">Data</th>
              <th className="px-3 py-2 text-left">Cliente</th>
              <th className="px-3 py-2 text-left">Itens</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-center">Status</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {pedidos.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="px-3 py-3">
                  {p.status !== 'pago' && (
                    <input
                      type="checkbox"
                      checked={selecionados.has(p.id)}
                      onChange={() => toggleSelecionado(p.id)}
                    />
                  )}
                </td>
                <td className="px-3 py-3 text-xs text-gray-500">
                  {new Date(p.created_at).toLocaleDateString('pt-BR')}
                </td>
                <td className="px-3 py-3 font-medium">{p.nome_guerra}</td>
                <td className="px-3 py-3 text-xs text-gray-500 max-w-[150px] truncate">
                  {p.itens_resumo}
                </td>
                <td className="px-3 py-3 text-right font-bold">R$ {p.total.toFixed(2)}</td>
                <td className="px-3 py-3 text-center">{statusBadge(p.status)}</td>
                <td className="px-3 py-3">
                  {p.status !== 'pago' && (
                    <button onClick={() => marcarPago(p.id)} className="text-azul text-xs hover:underline">
                      Pagar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {pedidos.length === 0 && (
          <div className="text-center py-8 text-gray-400">Nenhum pedido</div>
        )}
      </div>
    </AdminLayout>
  );
}
