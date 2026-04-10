import { useEffect, useState } from 'react';
import { AdminLayout } from '../../components/Layout';
import { StatCard } from '../../components/admin/StatCard';
import { api } from '../../services/api';
import { montarLinkCobranca } from '../../services/whatsapp';
import type { DashboardStats } from '../../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => { api.get<DashboardStats>('/api/admin/stats').then(setStats); }, []);

  if (!stats) return <AdminLayout><div className="text-center py-10 text-texto-fraco">Carregando...</div></AdminLayout>;

  const chartData = stats.ultimos_7_dias.map((d) => ({ data: d.data.slice(5), total: d.total }));

  return (
    <AdminLayout>
      <h1 className="font-display text-2xl text-azul tracking-wider mb-5">DASHBOARD</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Vendido no mês" value={`R$ ${stats.vendido_mes.toFixed(2)}`} />
        <StatCard label="Recebido" value={`R$ ${stats.recebido_mes.toFixed(2)}`} color="text-verde" />
        <StatCard label="Pendente" value={`R$ ${stats.pendente_total.toFixed(2)}`} color="text-vermelho" />
        <StatCard label="Vendas hoje" value={String(stats.vendas_hoje)} color="text-azul" />
      </div>

      {chartData.length > 0 && (
        <div className="bg-white rounded-xl p-5 mb-6 border border-borda shadow-sm">
          <h2 className="text-sm font-medium text-texto-fraco uppercase tracking-wider mb-4">Últimos 7 dias</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <XAxis dataKey="data" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v: number) => [`R$ ${v.toFixed(2)}`, 'Total']}
                contentStyle={{ background: '#fff', border: '1px solid #e2e5eb', borderRadius: '8px' }}
                cursor={{ fill: 'rgba(0,0,0,0.04)' }}
              />
              <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={i === chartData.length - 1 ? '#16a34a' : '#1d3fa0'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {stats.devedores.length > 0 && (
        <div className="bg-white rounded-xl p-5 border border-borda shadow-sm">
          <h2 className="text-sm font-medium text-texto-fraco uppercase tracking-wider mb-4">Devedores</h2>
          <div className="space-y-1">
            {stats.devedores.map((d) => (
              <div key={d.cliente_id} className="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-fundo transition-colors border-b border-borda last:border-0">
                <div>
                  <span className="font-medium">{d.nome_guerra}</span>
                  <span className="text-vermelho font-bold ml-3 font-display tracking-wide">R$ {d.total_devido.toFixed(2)}</span>
                </div>
                <a href={montarLinkCobranca(d.nome_guerra, d.total_devido)} target="_blank" rel="noopener noreferrer"
                  className="text-verde text-sm font-medium hover:underline flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
                  Cobrar
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
