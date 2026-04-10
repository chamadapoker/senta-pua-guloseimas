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

  if (!cliente) return <AdminLayout><div className="text-center py-10 text-texto-fraco">Carregando...</div></AdminLayout>;

  const statusBadge = (status: string) => {
    if (status === 'pago') return <Badge variant="success">Pago</Badge>;
    if (status === 'fiado') return <Badge variant="danger">Fiado</Badge>;
    return <Badge variant="warning">Pendente</Badge>;
  };

  return (
    <AdminLayout>
      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 rounded-full bg-azul flex items-center justify-center text-white font-display text-xl tracking-wider border-2 border-azul-claro/30">
          {cliente.nome_guerra.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <h1 className="font-display text-xl text-texto tracking-wider">{cliente.nome_guerra}</h1>
          {saldoDevedor > 0 && (
            <span className="text-vermelho font-bold font-display tracking-wide">Deve R$ {saldoDevedor.toFixed(2)}</span>
          )}
        </div>
      </div>

      {saldoDevedor > 0 && (
        <Button variant="danger" size="sm" className="mb-5" onClick={handlePdfWhatsapp}>
          Gerar PDF + WhatsApp
        </Button>
      )}

      <div className="space-y-3">
        {pedidos.map((p) => (
          <div key={p.id} className="bg-white rounded-xl p-4 border border-borda shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-texto-fraco">
                {new Date(p.created_at).toLocaleDateString('pt-BR')}
              </span>
              {statusBadge(p.status)}
            </div>
            <div className="text-sm text-texto-fraco mb-2">{p.itens_resumo || 'Itens do pedido'}</div>
            <div className="flex items-center justify-between">
              <span className="font-bold text-dourado font-display tracking-wide">R$ {p.total.toFixed(2)}</span>
              {p.status !== 'pago' && (
                <Button size="sm" variant="outline" onClick={() => marcarPago(p.id)}>
                  Marcar pago
                </Button>
              )}
            </div>
          </div>
        ))}
        {pedidos.length === 0 && (
          <div className="text-center py-10 text-texto-fraco">Nenhum pedido</div>
        )}
      </div>
    </AdminLayout>
  );
}
