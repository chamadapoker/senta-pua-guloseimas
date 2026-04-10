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

type Filtro = '' | 'oficial' | 'graduado';

export function CafeDashboard() {
  const [filtro, setFiltro] = useState<Filtro>('');
  const [stats, setStats] = useState<CafeStats | null>(null);

  useEffect(() => {
    const query = filtro ? `?tipo=${filtro}` : '';
    api.get<CafeStats>(`/api/cafe/admin/stats${query}`).then(setStats);
  }, [filtro]);

  if (!stats) return <AdminLayout><div className="text-center py-10 text-texto-fraco">Carregando...</div></AdminLayout>;

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display text-2xl text-azul tracking-wider">CAIXINHA DO CAFE</h1>
        <div className="flex gap-1">
          {([['', 'Todos'], ['oficial', 'Oficiais'], ['graduado', 'Graduados']] as [Filtro, string][]).map(([f, label]) => (
            <button key={f} onClick={() => setFiltro(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filtro === f ? 'bg-azul text-white' : 'bg-white text-texto-fraco border border-borda hover:text-texto'
              }`}>
              {label}
            </button>
          ))}
        </div>
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
