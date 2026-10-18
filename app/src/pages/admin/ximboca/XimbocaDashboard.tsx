import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppLayout } from '../../../components/AppLayout';
import { StatCard } from '../../../components/admin/StatCard';
import { api } from '../../../services/api';
import { Loading } from '../../../components/ui/Loading';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Icon } from '../../../components/ui/Icon';

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

const brl = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataEvento = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

export function XimbocaDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<XimbocaStats | null>(null);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [erro, setErro] = useState('');
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    setErro('');
    api.get<XimbocaStats>('/api/ximboca/stats')
      .then(setStats)
      .catch((e: any) => setErro(e?.message || 'Não foi possível carregar os dados da Ximboca.'));
    api.get<Evento[]>('/api/ximboca/eventos')
      .then(setEventos)
      .catch(() => { /* lista de eventos é secundária; o erro principal já aparece acima */ });
  }, [tentativa]);

  const header = (
    <PageHeader
      title="Ximboca"
      subtitle="Resumo financeiro dos eventos e acesso rápido aos mais recentes."
      right={
        <Button size="sm" onClick={() => navigate('/admin/ximboca/eventos')}><Icon name="cutlery" size={16} />Ver eventos</Button>
      }
    />
  );

  if (!stats) {
    return (
      <AppLayout>
        {header}
        {erro ? (
          <Card size="lg" className="text-center">
            <p className="text-escarlate text-sm mb-4">{erro}</p>
            <Button variant="ghost" size="sm" onClick={() => setTentativa(n => n + 1)}>
              <Icon name="refresh" size={16} />Tentar de novo
            </Button>
          </Card>
        ) : <Loading />}
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {header}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total arrecadado" value={brl(stats.total_arrecadado)} color="text-verde-escuro" icon={<Icon name="cash" size={18} />} />
        <StatCard label="Total gasto" value={brl(stats.total_gasto)} color="text-escarlate" icon={<Icon name="cart" size={18} />} />
        <StatCard label="Saldo" value={brl(stats.saldo)} color={stats.saldo >= 0 ? 'text-verde-escuro' : 'text-escarlate'} icon={<Icon name="vault" size={18} />} />
        <StatCard label="Eventos abertos" value={String(stats.eventos_abertos)} color="text-azul" icon={<Icon name="cutlery" size={18} />} hint={`${stats.total_eventos} no total`} />
      </div>

      <Card className="!p-0 overflow-hidden">
        <div className="px-4 sm:px-5 py-3 border-b border-borda flex items-center justify-between gap-3">
          <h2 className="font-display text-xl text-noite tracking-wide leading-none">Eventos recentes</h2>
          <Link to="/admin/ximboca/eventos" className="text-sm font-medium text-azul hover:underline min-h-[40px] inline-flex items-center">Ver todos</Link>
        </div>
        {eventos.length === 0 ? (
          <EmptyState
            icon={<Icon name="cutlery" size={24} />}
            message="Nenhum evento criado ainda"
            hint="Crie o primeiro evento para começar a receber inscrições."
            action={<Button size="sm" onClick={() => navigate('/admin/ximboca/eventos')}><Icon name="plus" size={16} />Criar evento</Button>}
          />
        ) : (
          <div className="divide-y divide-borda">
            {eventos.slice(0, 5).map(e => (
              <Link key={e.id} to={`/admin/ximboca/eventos/${e.id}`} className="block px-4 sm:px-5 py-3.5 hover:bg-fundo transition-colors">
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className="font-medium text-noite truncate">{e.nome}</span>
                    <Badge variant={e.status === 'aberto' ? 'success' : 'neutral'}>{e.status === 'aberto' ? 'Aberto' : 'Fechado'}</Badge>
                  </div>
                  <span className="text-xs text-texto-fraco shrink-0">{dataEvento(e.data)}</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-texto-fraco">
                  <span>{e.total_pagos} de {e.total_participantes} pagos</span>
                  <span>Arrecadado <span className="text-verde-escuro font-medium">{brl(e.total_arrecadado)}</span></span>
                  <span>Gasto <span className="text-escarlate font-medium">{brl(e.total_despesas)}</span></span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </AppLayout>
  );
}
