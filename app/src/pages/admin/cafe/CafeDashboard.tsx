import { useEffect, useState } from 'react';
import { AdminLayout } from '../../../components/Layout';
import { StatCard } from '../../../components/admin/StatCard';
import { api } from '../../../services/api';

interface CafeStats {
  total_assinantes: number;
  recebido_mes: number;
  pendente_total: number;
  insumos_alerta: number;
}

export function CafeDashboard() {
  const [stats, setStats] = useState<CafeStats | null>(null);

  useEffect(() => { api.get<CafeStats>('/api/cafe/admin/stats').then(setStats); }, []);

  if (!stats) return <AdminLayout><div className="text-center py-10 text-texto-fraco">Carregando...</div></AdminLayout>;

  return (
    <AdminLayout>
      <h1 className="font-display text-2xl text-azul tracking-wider mb-5">CAIXINHA DO CAFE</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Assinantes" value={String(stats.total_assinantes)} color="text-azul" />
        <StatCard label="Recebido no mes" value={`R$ ${stats.recebido_mes.toFixed(2)}`} color="text-verde" />
        <StatCard label="Pendente total" value={`R$ ${stats.pendente_total.toFixed(2)}`} color="text-vermelho" />
        <StatCard label="Insumos em alerta" value={String(stats.insumos_alerta)} color={stats.insumos_alerta > 0 ? 'text-vermelho' : 'text-verde'} />
      </div>
    </AdminLayout>
  );
}
