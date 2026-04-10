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
  const [tipo, setTipo] = useState<'oficial' | 'graduado'>(() =>
    (localStorage.getItem('cafe_tipo') as 'oficial' | 'graduado') || 'graduado'
  );
  const [stats, setStats] = useState<CafeStats | null>(null);

  useEffect(() => { localStorage.setItem('cafe_tipo', tipo); }, [tipo]);
  useEffect(() => {
    setStats(null);
    api.get<CafeStats>(`/api/cafe/admin/stats?tipo=${tipo}`).then(setStats);
  }, [tipo]);

  if (!stats) return <AdminLayout><div className="text-center py-10 text-texto-fraco">Carregando...</div></AdminLayout>;

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-2">
        <h1 className="font-display text-2xl text-azul tracking-wider">CAIXINHA DO CAFE</h1>
      </div>
      <div className="flex gap-1 mb-5">
        <button onClick={() => setTipo('oficial')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tipo === 'oficial' ? 'bg-azul text-white' : 'bg-white text-texto-fraco border border-borda'}`}>
          Oficiais
        </button>
        <button onClick={() => setTipo('graduado')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tipo === 'graduado' ? 'bg-azul text-white' : 'bg-white text-texto-fraco border border-borda'}`}>
          Graduados
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Assinantes" value={String(stats.total_assinantes)} color="text-azul" />
        <StatCard label="Recebido no mes" value={`R$ ${stats.recebido_mes.toFixed(2)}`} color="text-verde" />
        <StatCard label="Pendente total" value={`R$ ${stats.pendente_total.toFixed(2)}`} color="text-vermelho" />
        <StatCard label="Insumos em alerta" value={String(stats.insumos_alerta)} color={stats.insumos_alerta > 0 ? 'text-vermelho' : 'text-verde'} />
      </div>
    </AdminLayout>
  );
}
