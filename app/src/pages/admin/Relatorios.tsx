import { useState } from 'react';
import { AppLayout } from '../../components/AppLayout';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { StatCard } from '../../components/admin/StatCard';
import { api } from '../../services/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface Relatorio {
  periodo: { de: string; ate: string };
  resumo: { total_pedidos: number; total_vendido: number; total_recebido: number; total_pendente: number };
  por_metodo: { metodo_pagamento: string; status: string; qtd: number; valor: number }[];
  por_dia: { data: string; pedidos: number; total: number }[];
  top_produtos: { nome_produto: string; qtd_vendida: number; total_vendido: number }[];
  devedores: { nome_guerra: string; total_devido: number; pedidos: number }[];
}

export function Relatorios() {
  const now = new Date();
  const mesAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [de, setDe] = useState(`${mesAtual}-01`);
  const [ate, setAte] = useState(now.toISOString().split('T')[0]);
  const [relatorio, setRelatorio] = useState<Relatorio | null>(null);
  const [loading, setLoading] = useState(false);

  const gerar = async () => {
    setLoading(true);
    try {
      const data = await api.get<Relatorio>(`/api/admin/relatorio?de=${de}&ate=${ate}`);
      setRelatorio(data);
    } catch { alert('Erro ao gerar relatório'); }
    finally { setLoading(false); }
  };

  const chartData = relatorio?.por_dia.map(d => ({
    data: new Date(d.data + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    total: d.total,
    pedidos: d.pedidos,
  })) || [];

  return (
    <AppLayout>
      <h1 className="font-display text-2xl text-azul tracking-wider mb-5">RELATÓRIOS</h1>

      <div className="bg-white rounded-xl border border-borda shadow-sm p-5 mb-6">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-texto-fraco mb-1">De</label>
            <input type="date" value={de} onChange={e => setDe(e.target.value)}
              className="bg-white border border-borda rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-texto-fraco mb-1">Até</label>
            <input type="date" value={ate} onChange={e => setAte(e.target.value)}
              className="bg-white border border-borda rounded-lg px-3 py-2 text-sm" />
          </div>
          <Button onClick={gerar} disabled={loading}>{loading ? 'Gerando...' : 'Gerar Relatório'}</Button>
        </div>
      </div>

      {relatorio && (
        <div className="space-y-6 animate-fade-in">
          {/* Resumo */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Total Vendido" value={`R$ ${relatorio.resumo.total_vendido.toFixed(2)}`} />
            <StatCard label="Recebido" value={`R$ ${relatorio.resumo.total_recebido.toFixed(2)}`} color="text-verde" />
            <StatCard label="Pendente/Fiado" value={`R$ ${relatorio.resumo.total_pendente.toFixed(2)}`} color="text-vermelho" />
            <StatCard label="Pedidos" value={String(relatorio.resumo.total_pedidos)} color="text-azul" />
          </div>

          {/* Gráfico vendas por dia */}
          {chartData.length > 0 && (
            <div className="bg-white rounded-xl p-5 border border-borda shadow-sm">
              <h2 className="text-sm font-medium text-texto-fraco uppercase tracking-wider mb-4">Vendas por Dia</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e5eb" vertical={false} />
                  <XAxis dataKey="data" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} tickFormatter={v => `R$${v}`} />
                  <Tooltip
                    formatter={(v: number, name: string) => [`R$ ${v.toFixed(2)}`, name === 'total' ? 'Vendas' : 'Pedidos']}
                    contentStyle={{ background: '#1d3fa0', border: 'none', borderRadius: '10px', color: '#fff', fontSize: '13px', padding: '8px 14px' }}
                    labelStyle={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Bar dataKey="total" fill="#1d3fa0" radius={[8, 8, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Top Produtos */}
          {relatorio.top_produtos.length > 0 && (
            <div className="bg-white rounded-xl overflow-hidden border border-borda shadow-sm">
              <div className="bg-azul px-5 py-3">
                <h2 className="text-sm font-medium text-white uppercase tracking-wider">Top Produtos</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-borda">
                      <th className="px-4 py-2 text-left text-xs text-texto-fraco">#</th>
                      <th className="px-4 py-2 text-left text-xs text-texto-fraco">Produto</th>
                      <th className="px-4 py-2 text-right text-xs text-texto-fraco">Qtd</th>
                      <th className="px-4 py-2 text-right text-xs text-texto-fraco">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {relatorio.top_produtos.map((p, i) => (
                      <tr key={p.nome_produto} className="border-b border-borda/50 hover:bg-fundo">
                        <td className="px-4 py-2 text-texto-fraco">{i + 1}</td>
                        <td className="px-4 py-2 font-medium">{p.nome_produto}</td>
                        <td className="px-4 py-2 text-right">{p.qtd_vendida}</td>
                        <td className="px-4 py-2 text-right font-bold text-azul">R$ {p.total_vendido.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Por método */}
          {relatorio.por_metodo.length > 0 && (
            <div className="bg-white rounded-xl overflow-hidden border border-borda shadow-sm">
              <div className="bg-azul px-5 py-3">
                <h2 className="text-sm font-medium text-white uppercase tracking-wider">Por Método / Status</h2>
              </div>
              <div className="p-4 space-y-2">
                {relatorio.por_metodo.map((m, i) => (
                  <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-fundo">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium capitalize">{m.metodo_pagamento}</span>
                      <Badge variant={m.status === 'pago' ? 'success' : m.status === 'fiado' ? 'danger' : 'warning'}>{m.status}</Badge>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold">R$ {m.valor.toFixed(2)}</span>
                      <span className="text-xs text-texto-fraco ml-2">({m.qtd}x)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Devedores no período */}
          {relatorio.devedores.length > 0 && (
            <div className="bg-white rounded-xl overflow-hidden border border-borda shadow-sm">
              <div className="bg-vermelho px-5 py-3">
                <h2 className="text-sm font-medium text-white uppercase tracking-wider">Devedores no Período</h2>
              </div>
              <div className="p-4 space-y-1">
                {relatorio.devedores.map(d => (
                  <div key={d.nome_guerra} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-fundo">
                    <span className="font-medium">{d.nome_guerra}</span>
                    <div>
                      <span className="text-vermelho font-bold font-display">R$ {d.total_devido.toFixed(2)}</span>
                      <span className="text-xs text-texto-fraco ml-2">({d.pedidos} pedido{d.pedidos > 1 ? 's' : ''})</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </AppLayout>
  );
}
