import { useState } from 'react';
import { AppLayout } from '../../components/AppLayout';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Loading } from '../../components/ui/Loading';
import { Icon } from '../../components/ui/Icon';
import { inputClass } from '../../components/ui/Field';
import { StatCard } from '../../components/admin/StatCard';
import { api } from '../../services/api';
import { dataLocal } from '../../services/periodo';
import { useToast } from '../../hooks/useToast';
import { PageHeader } from '../../components/ui/PageHeader';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { TooltipNoite } from '../../components/charts/ChartCard';
import { COR_AREA, TINTA, brlCurto, eixoProps } from '../../components/charts/tema';

interface Relatorio {
  periodo: { de: string; ate: string };
  resumo: { total_pedidos: number; total_vendido: number; total_recebido: number; total_pendente: number };
  por_metodo: { metodo_pagamento: string; status: string; qtd: number; valor: number }[];
  por_dia: { data: string; pedidos: number; total: number }[];
  top_produtos: { nome_produto: string; qtd_vendida: number; total_vendido: number }[];
  devedores: { nome_guerra: string; total_devido: number; pedidos: number }[];
}

const brl = (v: number) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const METODO: Record<string, string> = { pix: 'Pix', dinheiro: 'Dinheiro', fiado: 'Fiado' };
const STATUS: Record<string, string> = { pago: 'Pago', fiado: 'Fiado', pendente: 'Pendente' };

function Secao({ titulo, descricao, children }: { titulo: string; descricao?: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-borda shadow-sm overflow-hidden min-w-0">
      <div className="px-5 pt-5 pb-3">
        <h2 className="text-base font-semibold text-noite">{titulo}</h2>
        {descricao && <p className="text-xs text-texto-fraco mt-0.5">{descricao}</p>}
      </div>
      {children}
    </section>
  );
}

export function Relatorios() {
  const hoje = dataLocal(new Date());
  const [de, setDe] = useState(`${hoje.slice(0, 7)}-01`);
  const [ate, setAte] = useState(hoje);
  const { showToast } = useToast();
  const [relatorio, setRelatorio] = useState<Relatorio | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  const gerar = async () => {
    setLoading(true);
    setErro('');
    try {
      const data = await api.get<Relatorio>(`/api/admin/relatorio?de=${de}&ate=${ate}`);
      setRelatorio(data);
    } catch (e: any) {
      const msg = e?.message || 'Erro ao gerar relatório';
      setErro(msg);
      showToast(msg, 'error');
    }
    finally { setLoading(false); }
  };

  const chartData = relatorio?.por_dia.map(d => ({
    data: new Date(d.data + 'T12:00:00Z').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' }),
    total: d.total,
    pedidos: d.pedidos,
  })) || [];

  const fmtData = (d: string) => d.split('-').reverse().join('/');
  const invertido = !!(de && ate && de > ate);

  return (
    <AppLayout>
      <PageHeader title="Relatório de vendas" subtitle="Vendas, recebimentos e dívidas da cantina em um período." />

      <form
        onSubmit={(e) => { e.preventDefault(); gerar(); }}
        className="bg-white rounded-2xl border border-borda shadow-sm p-4 sm:p-5 mb-6 grid grid-cols-2 sm:flex sm:flex-wrap gap-3 sm:items-end"
      >
        <div className="min-w-0">
          <label htmlFor="rel-de" className="block text-sm font-medium mb-1.5">De</label>
          <input id="rel-de" type="date" value={de} max={ate || undefined} onChange={e => setDe(e.target.value)} className={`${inputClass} min-h-[44px]`} />
        </div>
        <div className="min-w-0">
          <label htmlFor="rel-ate" className="block text-sm font-medium mb-1.5">Até</label>
          <input id="rel-ate" type="date" value={ate} min={de || undefined} onChange={e => setAte(e.target.value)} className={`${inputClass} min-h-[44px]`} />
        </div>
        <Button type="submit" className="col-span-2 sm:col-span-1" disabled={loading || invertido}>
          <Icon name="chart" size={16} /> {loading ? 'Gerando...' : 'Gerar relatório'}
        </Button>
        {invertido && <p className="col-span-2 text-xs text-escarlate sm:basis-full">A data inicial é depois da final.</p>}
      </form>

      {loading && !relatorio ? (
        <Loading label="Gerando relatório..." />
      ) : erro && !relatorio ? (
        <Card className="text-center py-8">
          <p className="text-[15px] font-medium text-texto">Não foi possível gerar o relatório.</p>
          <p className="text-sm text-texto-fraco mt-1">{erro}</p>
          <Button variant="primary" size="sm" className="mt-4" onClick={gerar}>
            <Icon name="refresh" size={16} /> Tentar de novo
          </Button>
        </Card>
      ) : !relatorio ? (
        <Card>
          <EmptyState
            icon={<Icon name="chart" size={26} />}
            message="Escolha o período e gere o relatório"
            hint="Por padrão, o período é do primeiro dia do mês até hoje."
          />
        </Card>
      ) : (
        <div className={`space-y-6 ${loading ? 'opacity-60' : ''}`}>
          <p className="text-sm text-texto-fraco">
            Período de <strong className="text-texto">{fmtData(relatorio.periodo?.de || de)}</strong> a <strong className="text-texto">{fmtData(relatorio.periodo?.ate || ate)}</strong>
          </p>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <StatCard label="Total vendido" value={brl(relatorio.resumo.total_vendido)} color="text-noite" icon={<Icon name="cart" size={22} />} />
            <StatCard label="Recebido" value={brl(relatorio.resumo.total_recebido)} color="text-verde" icon={<Icon name="check" size={22} />} />
            <StatCard label="Pendente ou fiado" value={brl(relatorio.resumo.total_pendente)} color={relatorio.resumo.total_pendente > 0 ? 'text-escarlate' : 'text-verde'} icon={<Icon name="clock" size={22} />} />
            <StatCard label="Pedidos" value={String(relatorio.resumo.total_pedidos)} color="text-azul" icon={<Icon name="bag" size={22} />} />
          </div>

          {chartData.length > 0 && (
            <Secao titulo="Vendas por dia" descricao="Total vendido em cada dia do período.">
              <div className="px-2 sm:px-4 pb-4">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} barCategoryGap="20%" margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke={TINTA.grade} vertical={false} />
                    <XAxis dataKey="data" {...eixoProps} interval="preserveStartEnd" minTickGap={16} />
                    <YAxis {...eixoProps} width={64} tickFormatter={brlCurto} />
                    <Tooltip content={<TooltipNoite />} cursor={{ fill: 'rgba(13,22,64,0.05)' }} />
                    <Bar dataKey="total" name="Vendas" fill={COR_AREA.cantina} radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Secao>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <Secao titulo="Produtos mais vendidos" descricao="Ordenados pelo valor vendido.">
              {relatorio.top_produtos.length === 0 ? (
                <p className="px-5 pb-5 text-sm text-texto-fraco">Nenhum produto vendido no período.</p>
              ) : (
                <ol className="divide-y divide-borda border-t border-borda">
                  {relatorio.top_produtos.map((p, i) => (
                    <li key={p.nome_produto} className="flex items-center gap-3 px-5 py-3">
                      <span className="w-6 text-sm text-texto-fraco tabular-nums shrink-0">{i + 1}</span>
                      <span className="flex-1 min-w-0">
                        <span className="block font-medium text-texto truncate">{p.nome_produto}</span>
                        <span className="block text-xs text-texto-fraco">{p.qtd_vendida} unidade{p.qtd_vendida === 1 ? '' : 's'}</span>
                      </span>
                      <span className="font-display text-xl leading-none tracking-wide text-dourado shrink-0">{brl(p.total_vendido)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </Secao>

            <Secao titulo="Por forma de pagamento" descricao="Quanto entrou em cada forma e situação.">
              {relatorio.por_metodo.length === 0 ? (
                <p className="px-5 pb-5 text-sm text-texto-fraco">Sem pedidos no período.</p>
              ) : (
                <ul className="divide-y divide-borda border-t border-borda">
                  {relatorio.por_metodo.map((m, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 px-5 py-3">
                      <span className="flex items-center gap-2 min-w-0 flex-wrap">
                        <span className="text-sm font-medium">{METODO[m.metodo_pagamento] ?? m.metodo_pagamento}</span>
                        <Badge variant={m.status === 'pago' ? 'success' : m.status === 'fiado' ? 'danger' : 'warning'}>{STATUS[m.status] ?? m.status}</Badge>
                      </span>
                      <span className="text-right shrink-0">
                        <span className="block text-sm font-semibold tabular-nums">{brl(m.valor)}</span>
                        <span className="block text-xs text-texto-fraco">{m.qtd} pedido{m.qtd === 1 ? '' : 's'}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Secao>
          </div>

          <Secao titulo="Devedores no período" descricao="Militares com pedidos não pagos dentro do período.">
            {relatorio.devedores.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-texto-fraco">Ninguém ficou devendo neste período.</p>
            ) : (
              <ul className="divide-y divide-borda border-t border-borda">
                {relatorio.devedores.map(d => (
                  <li key={d.nome_guerra} className="flex items-center justify-between gap-3 px-5 py-3">
                    <span className="min-w-0">
                      <span className="block font-medium truncate">{d.nome_guerra}</span>
                      <span className="block text-xs text-texto-fraco">{d.pedidos} pedido{d.pedidos > 1 ? 's' : ''}</span>
                    </span>
                    <span className="font-display text-xl leading-none tracking-wide text-escarlate shrink-0">{brl(d.total_devido)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Secao>
        </div>
      )}
    </AppLayout>
  );
}
