import { useEffect, useState } from 'react';
import { AppLayout } from '../../../components/AppLayout';
import { StatCard } from '../../../components/admin/StatCard';
import { api } from '../../../services/api';
import { Loading } from '../../../components/ui/Loading';
import { PageHeader } from '../../../components/ui/PageHeader';

interface LojaStats {
  vendido_mes: number;
  recebido_mes: number;
  pendente_total: number;
  vendas_hoje: number;
}

export function LojaDashboard() {
  const [stats, setStats] = useState<LojaStats | null>(null);

  useEffect(() => { api.get<LojaStats>('/api/loja/admin/stats').then(setStats); }, []);

  if (!stats) return <AppLayout><Loading /></AppLayout>;

  return (
    <AppLayout>
      <PageHeader title="LOJA MILITAR" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Vendido no mês" value={`R$ ${stats.vendido_mes.toFixed(2)}`} />
        <StatCard label="Recebido" value={`R$ ${stats.recebido_mes.toFixed(2)}`} color="text-verde" />
        <StatCard label="Pendente" value={`R$ ${stats.pendente_total.toFixed(2)}`} color="text-vermelho" />
        <StatCard label="Vendas hoje" value={String(stats.vendas_hoje)} color="text-azul" />
      </div>
    </AppLayout>
  );
}
