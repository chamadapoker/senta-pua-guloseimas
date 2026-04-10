import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminLayout } from '../../../components/Layout';
import { StatCard } from '../../../components/admin/StatCard';
import { api } from '../../../services/api';

interface XimbocaStats {
  total_eventos: number;
  total_arrecadado: number;
  total_gasto: number;
  saldo: number;
  eventos_abertos: number;
}

interface Evento {
  id: string;
  nome: string;
  data: string;
  valor_por_pessoa: number;
  status: string;
  total_participantes: number;
  total_pagos: number;
  total_arrecadado: number;
  total_despesas: number;
}

export function XimbocaDashboard() {
  const [stats, setStats] = useState<XimbocaStats | null>(null);
  const [eventos, setEventos] = useState<Evento[]>([]);

  useEffect(() => {
    api.get<XimbocaStats>('/api/ximboca/stats').then(setStats);
    api.get<Evento[]>('/api/ximboca/eventos').then(setEventos);
  }, []);

  if (!stats) return <AdminLayout><div className="text-center py-10 text-texto-fraco">Carregando...</div></AdminLayout>;

  return (
    <AdminLayout>
      <h1 className="font-display text-2xl text-azul tracking-wider mb-5">XIMBOCA</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total arrecadado" value={`R$ ${stats.total_arrecadado.toFixed(2)}`} color="text-verde" />
        <StatCard label="Total gasto" value={`R$ ${stats.total_gasto.toFixed(2)}`} color="text-vermelho" />
        <StatCard label="Saldo" value={`R$ ${stats.saldo.toFixed(2)}`} color={stats.saldo >= 0 ? 'text-verde' : 'text-vermelho'} />
        <StatCard label="Eventos abertos" value={String(stats.eventos_abertos)} color="text-azul" />
      </div>

      {eventos.length > 0 && (
        <div className="bg-white rounded-xl overflow-hidden border border-borda shadow-sm">
          <div className="bg-azul px-5 py-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-white uppercase tracking-wider">Eventos</h2>
            <Link to="/admin/ximboca/eventos" className="text-xs text-white/80 hover:text-white">Ver todos</Link>
          </div>
          <div className="divide-y divide-borda/50">
            {eventos.slice(0, 5).map(e => {
              const arrecadado = e.total_arrecadado;
              return (
                <Link key={e.id} to={`/admin/ximboca/eventos/${e.id}`} className="block p-4 hover:bg-fundo transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-texto">{e.nome}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${e.status === 'aberto' ? 'bg-green-50 text-verde border border-green-200' : 'bg-gray-100 text-texto-fraco border border-gray-200'}`}>
                        {e.status === 'aberto' ? 'ABERTO' : 'FECHADO'}
                      </span>
                    </div>
                    <span className="text-xs text-texto-fraco">{new Date(e.data + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-texto-fraco">
                    <span>{e.total_pagos}/{e.total_participantes} pagos</span>
                    <span>Arrecadado: R$ {arrecadado.toFixed(2)}</span>
                    <span>Gasto: R$ {e.total_despesas.toFixed(2)}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
