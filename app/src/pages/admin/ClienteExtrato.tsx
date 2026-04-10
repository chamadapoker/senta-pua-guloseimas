import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AdminLayout } from '../../components/Layout';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { api } from '../../services/api';
import { montarLinkCobranca } from '../../services/whatsapp';
import { gerarExtratoPDF } from '../../services/pdf';
import type { Cliente, Pedido } from '../../types';

export function ClienteExtrato() {
  const { id } = useParams<{ id: string }>();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);

  const carregar = async () => {
    if (!id) return;
    const data = await api.get<{ cliente: Cliente; pedidos: Pedido[] }>(`/api/clientes/${id}/extrato`);
    setCliente(data.cliente);
    setPedidos(data.pedidos);
  };

  useEffect(() => { carregar(); }, [id]);

  const marcarPago = async (pedidoId: string) => {
    await api.put(`/api/pedidos/${pedidoId}/pagar`, {});
    carregar();
  };

  const saldoDevedor = pedidos
    .filter((p) => p.status !== 'pago')
    .reduce((sum, p) => sum + p.total, 0);

  const handlePdfWhatsapp = async () => {
    if (!cliente) return;
    const pendentes = pedidos.filter((p) => p.status !== 'pago');
    await gerarExtratoPDF(cliente.nome_guerra, pendentes, saldoDevedor);
    window.open(montarLinkCobranca(cliente.nome_guerra, saldoDevedor), '_blank');
  };

  if (!cliente) return <AdminLayout><div className="text-center py-10 text-gray-400">Carregando...</div></AdminLayout>;

  const statusBadge = (status: string) => {
    if (status === 'pago') return <Badge variant="success">Pago</Badge>;
    if (status === 'fiado') return <Badge variant="danger">Fiado</Badge>;
    return <Badge variant="warning">Pendente</Badge>;
  };

  return (
    <AdminLayout>
      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 rounded-full bg-azul flex items-center justify-center text-white font-bold text-lg">
          {cliente.nome_guerra.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <h1 className="text-xl font-bold">{cliente.nome_guerra}</h1>
          {saldoDevedor > 0 && (
            <span className="text-vermelho font-bold">Deve R$ {saldoDevedor.toFixed(2)}</span>
          )}
        </div>
      </div>

      {saldoDevedor > 0 && (
        <Button variant="danger" size="sm" className="mb-4" onClick={handlePdfWhatsapp}>
          Gerar PDF + WhatsApp
        </Button>
      )}

      <div className="space-y-3">
        {pedidos.map((p) => (
          <div key={p.id} className="bg-white rounded-xl p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-400">
                {new Date(p.created_at).toLocaleDateString('pt-BR')}
              </span>
              {statusBadge(p.status)}
            </div>
            <div className="text-sm text-gray-600 mb-1">{p.itens_resumo || 'Itens do pedido'}</div>
            <div className="flex items-center justify-between">
              <span className="font-bold text-azul">R$ {p.total.toFixed(2)}</span>
              {p.status !== 'pago' && (
                <Button size="sm" variant="outline" onClick={() => marcarPago(p.id)}>
                  Marcar pago
                </Button>
              )}
            </div>
          </div>
        ))}
        {pedidos.length === 0 && (
          <div className="text-center py-8 text-gray-400">Nenhum pedido</div>
        )}
      </div>
    </AdminLayout>
  );
}
