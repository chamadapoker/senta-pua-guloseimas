import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '../../../components/AppLayout';
import { StatCard } from '../../../components/admin/StatCard';
import { api } from '../../../services/api';
import { Loading } from '../../../components/ui/Loading';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Icon } from '../../../components/ui/Icon';
import { GraficoLojaMeses } from '../../../components/charts/GraficosAreas';

interface LojaStats {
  vendido_mes: number;
  recebido_mes: number;
  pendente_total: number;
  vendas_hoje: number;
}

const brl = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function LojaDashboard() {
  const [stats, setStats] = useState<LojaStats | null>(null);
  const [erro, setErro] = useState('');
  const [tentativa, setTentativa] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    setErro('');
    api.get<LojaStats>('/api/loja/admin/stats')
      .then(setStats)
      .catch((e: any) => setErro(e?.message || 'Erro ao carregar dados da loja'));
  }, [tentativa]);

  const header = (
    <PageHeader
      title="Loja militar"
      subtitle="Resumo das vendas da loja neste mês."
      right={
        <>
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin/loja/pedidos')}><Icon name="bag" size={16} /> Pedidos</Button>
          <Button size="sm" onClick={() => navigate('/admin/loja/produtos')}><Icon name="tag" size={16} /> Produtos</Button>
        </>
      }
    />
  );

  if (!stats) {
    return (
      <AppLayout>
        {header}
        {erro ? (
          <Card className="text-center py-10">
            <p className="text-escarlate text-sm mb-4">{erro}</p>
            <Button size="sm" onClick={() => setTentativa(n => n + 1)}><Icon name="refresh" size={16} /> Tentar de novo</Button>
          </Card>
        ) : <Loading />}
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {header}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Vendido no mês" value={brl(stats.vendido_mes)} color="text-dourado" icon={<Icon name="cart" size={18} />} />
        <StatCard label="Recebido no mês" value={brl(stats.recebido_mes)} color="text-verde" icon={<Icon name="check" size={18} />} />
        <StatCard label="A receber" value={brl(stats.pendente_total)} color="text-escarlate" icon={<Icon name="clock" size={18} />} hint="Pendentes e fiados, de todos os meses" />
        <StatCard label="Vendas hoje" value={String(stats.vendas_hoje)} color="text-azul" icon={<Icon name="bag" size={18} />} />
      </div>
      <GraficoLojaMeses />
    </AppLayout>
  );
}
