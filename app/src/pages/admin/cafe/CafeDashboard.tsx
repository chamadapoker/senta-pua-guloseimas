import { useEffect, useState } from 'react';
import { AppLayout } from '../../../components/AppLayout';
import { StatCard } from '../../../components/admin/StatCard';
import { api } from '../../../services/api';
import { Loading } from '../../../components/ui/Loading';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Icon } from '../../../components/ui/Icon';

interface CafeStats {
  total_assinantes: number;
  recebido_mes: number;
  pendente_total: number;
  insumos_alerta: number;
}

const brl = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function CafeDashboard() {
  const [tipo, setTipo] = useState<'oficial' | 'graduado'>(() =>
    (localStorage.getItem('cafe_tipo') as 'oficial' | 'graduado') || 'graduado'
  );
  const [stats, setStats] = useState<CafeStats | null>(null);
  const [erro, setErro] = useState('');
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => { localStorage.setItem('cafe_tipo', tipo); }, [tipo]);
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
      <PageHeader title="Caixinha do café" subtitle="Assinantes, mensalidades e insumos de cada sala." />

      <div className="flex flex-wrap gap-2 mb-5" role="group" aria-label="Sala do café">
        {(['oficial', 'graduado'] as const).map(t => (
          <Button key={t} size="sm" variant={tipo === t ? 'primary' : 'chip'} aria-pressed={tipo === t} onClick={() => setTipo(t)}>
            {t === 'oficial' ? 'Oficiais' : 'Graduados'}
          </Button>
        ))}
      </div>

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
          <StatCard label="A receber" value={brl(stats.pendente_total)} color={stats.pendente_total > 0 ? 'text-escarlate' : 'text-verde'} icon={<Icon name="clock" size={18} />} hint="Mensalidades em aberto" />
          <StatCard label="Insumos em alerta" value={String(stats.insumos_alerta)} color={stats.insumos_alerta > 0 ? 'text-escarlate' : 'text-verde'} icon={<Icon name="coffee" size={18} />} hint={stats.insumos_alerta > 0 ? 'Abaixo do estoque mínimo' : 'Estoque em dia'} />
        </div>
      )}
    </AppLayout>
  );
}
