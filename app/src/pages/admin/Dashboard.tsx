import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { StatCard } from '../../components/admin/StatCard';
import { api } from '../../services/api';
import { Loading } from '../../components/ui/Loading';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Icon, type IconName } from '../../components/ui/Icon';
import { useConfirm } from '../../hooks/useConfirm';
import { useToast } from '../../hooks/useToast';
import { useComprovantesPendentes } from '../../hooks/useComprovantesPendentes';
import { montarLinkCobranca } from '../../services/whatsapp';
import type { DashboardStats } from '../../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const brl = (v: number) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface Atencao {
  to: string;
  icon: IconName;
  titulo: string;
  detalhe: string;
  tom: 'escarlate' | 'ambar';
}

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [erro, setErro] = useState(false);
  const confirmar = useConfirm();
  const { showToast } = useToast();
  const comprovantesPendentes = useComprovantesPendentes(true);

  const carregar = () => {
    setErro(false);
    api.get<DashboardStats>('/api/admin/stats').then(setStats).catch(() => setErro(true));
  };
  useEffect(() => { carregar(); }, []);

  if (erro) {
    return (
      <AppLayout>
        <PageHeader title="Painel" subtitle="Resumo das vendas e do que precisa de atenção hoje." />
        <Card size="lg" className="text-center">
          <p className="text-[15px] font-medium text-texto">Não foi possível carregar o painel.</p>
          <p className="text-sm text-texto-fraco mt-1">Verifique a conexão e tente de novo.</p>
          <Button variant="primary" size="sm" className="mt-4" onClick={() => { setStats(null); carregar(); }}>
            <Icon name="refresh" size={16} /> Tentar de novo
          </Button>
        </Card>
      </AppLayout>
    );
  }
  if (!stats) return <AppLayout><Loading label="Carregando painel..." /></AppLayout>;

  const chartData = (stats.ultimos_7_dias ?? []).map((d) => ({
    data: new Date(d.data + 'T12:00:00Z').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', timeZone: 'America/Sao_Paulo' }),
    total: d.total,
  }));

  const devedores = stats.devedores ?? [];

  const atencao: Atencao[] = [];
  if (comprovantesPendentes > 0) {
    atencao.push({
      to: '/admin/comprovantes',
      icon: 'paper-clip',
      titulo: `${comprovantesPendentes} comprovante${comprovantesPendentes > 1 ? 's' : ''} aguardando aprovação`,
      detalhe: 'Confira e aprove para dar baixa nas contas.',
      tom: 'ambar',
    });
  }
  if (stats.pendente_total > 0) {
    atencao.push({
      to: '/admin/pedidos?status=pendente',
      icon: 'clock',
      titulo: `${brl(stats.pendente_total)} em pedidos pendentes`,
      detalhe: 'Veja os pedidos ainda não pagos.',
      tom: 'ambar',
    });
  }
  if (devedores.length > 0) {
    atencao.push({
      to: '/admin/cobrancas',
      icon: 'bell',
      titulo: `${devedores.length} militar${devedores.length > 1 ? 'es' : ''} com dívida`,
      detalhe: 'Gere o PDF e cobre pelo WhatsApp.',
      tom: 'escarlate',
    });
  }

  const cobrarTodos = async () => {
    const devedoresComZap = devedores.filter(d => d.whatsapp);
    if (!devedoresComZap.length) { showToast('Nenhum devedor com WhatsApp cadastrado', 'warning'); return; }
    if (!(await confirmar({ title: 'Cobrar todos', message: `Abrir o WhatsApp para ${devedoresComZap.length} devedor(es)?`, confirmText: 'Abrir', danger: false }))) return;
    devedoresComZap.forEach((d, i) => {
      setTimeout(() => window.open(montarLinkCobranca(d.nome_guerra, d.total_devido, d.whatsapp!), '_blank'), i * 1500);
    });
  };

  return (
    <AppLayout>
      <PageHeader title="Painel" subtitle="Resumo das vendas do mês e do que precisa de atenção hoje." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatCard label="Vendido no mês" value={brl(stats.vendido_mes)} color="text-noite" icon={<Icon name="cart" size={22} />} />
        <StatCard label="Recebido no mês" value={brl(stats.recebido_mes)} color="text-verde" icon={<Icon name="check" size={22} />} />
        <StatCard label="Pendente (total)" value={brl(stats.pendente_total)} color={stats.pendente_total > 0 ? 'text-escarlate' : 'text-verde'} icon={<Icon name="clock" size={22} />} />
        <StatCard label="Vendas hoje" value={String(stats.vendas_hoje)} color="text-azul" icon={<Icon name="bag" size={22} />} />
      </div>

      <section className="mb-6" aria-labelledby="atencao-titulo">
        <h2 id="atencao-titulo" className="text-base font-semibold text-noite mb-3">Precisa de atenção</h2>
        {atencao.length === 0 ? (
          <Card className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-green-50 border border-green-200 text-verde-escuro flex items-center justify-center shrink-0">
              <Icon name="check" size={20} />
            </span>
            <div>
              <p className="text-sm font-medium text-texto">Tudo em dia</p>
              <p className="text-xs text-texto-fraco">Sem comprovantes, pedidos pendentes ou dívidas no momento.</p>
            </div>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {atencao.map((a) => (
              <Link
                key={a.to}
                to={a.to}
                className="group bg-white border border-borda rounded-2xl shadow-sm p-4 flex items-start gap-3 hover:border-borda-forte focus-visible:ring-2 focus-visible:ring-azul/40 outline-none min-h-[44px]"
              >
                <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                  a.tom === 'escarlate' ? 'bg-red-50 border-red-200 text-escarlate' : 'bg-amber-50 border-amber-200 text-amber-700'
                }`}>
                  <Icon name={a.icon} size={20} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-texto">{a.titulo}</span>
                  <span className="block text-xs text-texto-fraco mt-0.5">{a.detalhe}</span>
                </span>
                <Icon name="chevron-right" size={18} className="text-texto-fraco shrink-0 mt-2.5 group-hover:text-texto" />
              </Link>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card size="lg" className="lg:col-span-3 min-w-0">
          <h2 className="text-base font-semibold text-noite mb-1">Vendas dos últimos 7 dias</h2>
          <p className="text-xs text-texto-fraco mb-4">Total vendido por dia.</p>
          {chartData.length === 0 ? (
            <p className="text-sm text-texto-fraco py-10 text-center">Ainda não há vendas nos últimos 7 dias.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e5eb" vertical={false} />
                <XAxis dataKey="data" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                  tickFormatter={(v) => `R$${v}`}
                />
                <Tooltip
                  formatter={(v: number) => [brl(v), 'Vendas']}
                  contentStyle={{ background: '#0d1640', border: 'none', borderRadius: '10px', color: '#fff', fontSize: '13px', padding: '8px 14px' }}
                  labelStyle={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px' }}
                  itemStyle={{ color: '#fff' }}
                  cursor={{ fill: 'rgba(29,63,160,0.06)' }}
                />
                <Bar dataKey="total" fill="#1d3fa0" radius={[8, 8, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card size="lg" className="lg:col-span-2 min-w-0 !p-0 overflow-hidden">
          <div className="px-5 pt-5 pb-3 flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-base font-semibold text-noite">Devedores</h2>
              <p className="text-xs text-texto-fraco">Quem tem saldo em aberto na cantina.</p>
            </div>
            {devedores.length > 0 && (
              <Button variant="chip-success" size="sm" onClick={cobrarTodos}>
                Cobrar todos no WhatsApp
              </Button>
            )}
          </div>
          {devedores.length === 0 ? (
            <p className="text-sm text-texto-fraco px-5 pb-6">Ninguém devendo. Bom trabalho.</p>
          ) : (
            <ul className="divide-y divide-borda border-t border-borda">
              {devedores.map((d) => (
                <li key={d.cliente_id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <Link to={`/admin/clientes/${d.cliente_id}`} className="font-medium text-texto hover:underline truncate block">
                      {d.nome_guerra}
                    </Link>
                    <span className="font-display text-xl leading-none tracking-wide text-escarlate">{brl(d.total_devido)}</span>
                  </div>
                  <a
                    href={montarLinkCobranca(d.nome_guerra, d.total_devido, d.whatsapp || undefined)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Cobrar ${d.nome_guerra} no WhatsApp`}
                    className="inline-flex items-center gap-1.5 rounded-xl min-h-[40px] px-3.5 text-sm font-medium bg-green-50 text-verde-escuro border border-green-200 hover:bg-green-100 shrink-0"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
                    Cobrar
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}
