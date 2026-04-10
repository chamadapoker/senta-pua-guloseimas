import { useEffect, useState } from 'react';
import { AdminLayout } from '../../components/Layout';
import { StatCard } from '../../components/admin/StatCard';
import { api } from '../../services/api';
import { montarLinkCobranca } from '../../services/whatsapp';
import type { DashboardStats } from '../../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    api.get<DashboardStats>('/api/admin/stats').then(setStats);
  }, []);

  if (!stats) return <AdminLayout><div className="text-center py-10 text-gray-400">Carregando...</div></AdminLayout>;

  const chartData = stats.ultimos_7_dias.map((d) => ({
    data: d.data.slice(5),
    total: d.total,
  }));

  return (
    <AdminLayout>
      <h1 className="text-xl font-bold text-azul mb-4">Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Vendido no mês" value={`R$ ${stats.vendido_mes.toFixed(2)}`} />
        <StatCard label="Recebido" value={`R$ ${stats.recebido_mes.toFixed(2)}`} color="text-green-600" />
        <StatCard label="Pendente" value={`R$ ${stats.pendente_total.toFixed(2)}`} color="text-vermelho" />
        <StatCard label="Vendas hoje" value={String(stats.vendas_hoje)} />
      </div>

      {chartData.length > 0 && (
        <div className="bg-white rounded-xl p-4 mb-6">
          <h2 className="text-sm font-medium text-gray-500 mb-3">Últimos 7 dias</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <XAxis dataKey="data" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: number) => `R$ ${v.toFixed(2)}`} />
              <Bar dataKey="total" fill="#1a3a6b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {stats.devedores.length > 0 && (
        <div className="bg-white rounded-xl p-4">
          <h2 className="text-sm font-medium text-gray-500 mb-3">Devedores</h2>
          <div className="space-y-2">
            {stats.devedores.map((d) => (
              <div key={d.cliente_id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <span className="font-medium">{d.nome_guerra}</span>
                  <span className="text-vermelho font-bold ml-2">R$ {d.total_devido.toFixed(2)}</span>
                </div>
                <a
                  href={montarLinkCobranca(d.nome_guerra, d.total_devido)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-600 text-sm font-medium hover:underline"
                >
                  WhatsApp
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
