import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../../../components/AppLayout';
import { StatCard } from '../../../components/admin/StatCard';
import { api } from '../../../services/api';
import { Loading } from '../../../components/ui/Loading';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Icon, type IconName } from '../../../components/ui/Icon';
import { GraficoCafeMeses } from '../../../components/charts/GraficosAreas';
import { SeletorSalaCafe, nomeSalaCafe, useConfigCafe, useSalaCafe } from './SalaCafe';

interface CafeStats {
  total_assinantes: number;
  recebido_mes: number;
  pendente_total: number;
  insumos_alerta: number;
}

const brl = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const ATALHOS: { to: string; label: string; icon: IconName }[] = [
  { to: '/admin/cafe/mensalidades', label: 'Mensalidades', icon: 'cash' },
  { to: '/admin/cafe/assinantes', label: 'Assinantes', icon: 'users' },
  { to: '/admin/cafe/despesas', label: 'Despesas', icon: 'credit-card' },
  { to: '/admin/cafe/insumos', label: 'Insumos', icon: 'archive' },
];

export function CafeDashboard() {
  const [tipo, setTipo] = useSalaCafe();
  const config = useConfigCafe();
  const [stats, setStats] = useState<CafeStats | null>(null);
  const [erro, setErro] = useState('');
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let ativo = true;
    setStats(null);
    setErro('');
    api.get<CafeStats>(`/api/cafe/admin/stats?tipo=${tipo}`)
      .then(r => { if (ativo) setStats(r); })
      .catch((e: any) => { if (ativo) setErro(e?.message || 'Erro ao carregar dados do café'); });
    return () => { ativo = false; };
  }, [tipo, tentativa]);

  return (
    <AppLayout>
      <SeletorSalaCafe sala={tipo} onChange={setTipo} config={config} />
      <PageHeader title="Caixinha do café" subtitle={`Assinantes, mensalidades e insumos da ${nomeSalaCafe(config, tipo)}.`} />

      {!stats ? (
        erro ? (
          <Card className="text-center py-10">
            <p className="text-escarlate text-sm mb-4">{erro}</p>
            <Button size="sm" onClick={() => setTentativa(n => n + 1)}><Icon name="refresh" size={16} /> Tentar de novo</Button>
          </Card>
        ) : <Loading />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <StatCard label="Assinantes" value={String(stats.total_assinantes)} color="text-azul" icon={<Icon name="users" size={18} />} />
          <StatCard label="Recebido no mês" value={brl(stats.recebido_mes)} color="text-verde" icon={<Icon name="check" size={18} />} />
          <StatCard label="A receber" value={brl(stats.pendente_total)} color={stats.pendente_total > 0 ? 'text-escarlate' : 'text-verde'} icon={<Icon name="clock" size={18} />} hint="Mensalidades e anuidades em aberto" />
          <StatCard label="Insumos em alerta" value={String(stats.insumos_alerta)} color={stats.insumos_alerta > 0 ? 'text-escarlate' : 'text-verde'} icon={<Icon name="coffee" size={18} />} hint={stats.insumos_alerta > 0 ? 'Abaixo do estoque mínimo' : 'Estoque em dia'} />
        </div>
      )}

      <nav aria-label="Telas do café" className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
        {ATALHOS.map(a => (
          <Link
            key={a.to}
            to={`${a.to}?sala=${tipo}`}
            className="flex items-center gap-2.5 bg-white rounded-xl border border-borda px-3 min-h-[48px] text-sm font-medium text-texto hover:border-azul/60 outline-none focus-visible:ring-2 focus-visible:ring-azul/40"
          >
            <Icon name={a.icon} size={18} className="text-azul" /> {a.label}
          </Link>
        ))}
      </nav>

      {stats && <GraficoCafeMeses tipo={tipo} />}
    </AppLayout>
  );
}
