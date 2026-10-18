import { useEffect, useState } from 'react';
import { AppLayout } from '../../components/AppLayout';
import { BackButton } from '../../components/ui/BackButton';
import { Icon } from '../../components/ui/Icon';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Loading } from '../../components/ui/Loading';
import { inputClass } from '../../components/ui/Field';
import { StatCard } from '../../components/admin/StatCard';
import { api } from '../../services/api';
import { useToast } from '../../hooks/useToast';

interface Item {
  id: string;
  nome: string;
  preco: number;
  preco_custo: number | null;
  qtd_vendida: number;
  receita: number;
  custo_total: number;
  tem_custo: boolean;
  lucro: number | null;
  margem: number | null;
}

interface Totais {
  receita: number;
  custo: number;
  lucro: number;
  sem_custo_count: number;
}

interface DataResp {
  cantina: { itens: Item[]; totais: Totais };
  loja:    { itens: Item[]; totais: Totais };
}

const brl = (v: number) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const corMargem = (m: number | null) => m == null ? 'text-texto-fraco' : m >= 30 ? 'text-verde-escuro' : m >= 0 ? 'text-amber-700' : 'text-escarlate';
const corLucro = (l: number | null) => l == null ? 'text-texto-fraco' : l >= 0 ? 'text-verde-escuro' : 'text-escarlate';

export function Lucratividade() {
  const [data, setData] = useState<DataResp | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [aba, setAba] = useState<'cantina' | 'loja'>('cantina');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const { showToast } = useToast();

  // Recebe o período explicitamente: evita ler estado velho logo após setDe/setAte.
  const carregar = (p: { de: string; ate: string } = { de, ate }) => {
    const qs = new URLSearchParams();
    if (p.de) qs.set('de', p.de);
    if (p.ate) qs.set('ate', p.ate);
    setCarregando(true);
    setErro('');
    api.get<DataResp>(`/api/admin/lucratividade${qs.toString() ? '?' + qs : ''}`)
      .then(setData)
      .catch((e: any) => {
        const msg = e?.message || 'Erro ao carregar lucratividade';
        setErro(msg);
        showToast(msg, 'error');
      })
      .finally(() => setCarregando(false));
  };

  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, []);

  const atual = data?.[aba];
  const margemTotal = atual && atual.totais.receita > 0 ? (atual.totais.lucro / atual.totais.receita) * 100 : null;

  return (
    <AppLayout>
      <BackButton to="/admin" className="mb-3" />
      <PageHeader title="Lucratividade" subtitle="Receita, custo e lucro de cada produto vendido (só pedidos pagos)." />

      <form
        onSubmit={(e) => { e.preventDefault(); carregar(); }}
        className="bg-white rounded-2xl border border-borda shadow-sm p-3 sm:p-4 mb-4 grid grid-cols-2 sm:flex sm:flex-wrap gap-3 sm:items-end"
      >
        <div className="min-w-0">
          <label htmlFor="luc-de" className="block text-sm font-medium mb-1.5">De</label>
          <input id="luc-de" type="date" value={de} onChange={e => setDe(e.target.value)} className={`${inputClass} min-h-[44px]`} />
        </div>
        <div className="min-w-0">
          <label htmlFor="luc-ate" className="block text-sm font-medium mb-1.5">Até</label>
          <input id="luc-ate" type="date" value={ate} onChange={e => setAte(e.target.value)} className={`${inputClass} min-h-[44px]`} />
        </div>
        <div className="col-span-2 flex gap-2">
          <Button type="submit" className="flex-1 sm:flex-none">Aplicar período</Button>
          <Button type="button" variant="ghost" onClick={() => { setDe(''); setAte(''); carregar({ de: '', ate: '' }); }}>Limpar</Button>
        </div>
        <p className="col-span-2 text-xs text-texto-fraco sm:basis-full">Sem datas, mostra todo o histórico.</p>
      </form>

      <div role="tablist" aria-label="Área" className="grid grid-cols-2 gap-1 bg-white rounded-2xl p-1 border border-borda shadow-sm mb-4">
        {(['cantina', 'loja'] as const).map(a => (
          <button
            key={a}
            role="tab"
            aria-selected={aba === a}
            onClick={() => setAba(a)}
            className={`min-h-[40px] rounded-xl text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-azul/40 ${aba === a ? 'bg-azul text-white' : 'text-texto-fraco hover:text-texto'}`}
          >
            {a === 'cantina' ? 'Cantina' : 'Loja'}
          </button>
        ))}
      </div>

      {carregando && !data ? (
        <Loading label="Calculando lucratividade..." />
      ) : erro && !data ? (
        <Card className="text-center py-8">
          <p className="text-[15px] font-medium text-texto">Não foi possível carregar a lucratividade.</p>
          <p className="text-sm text-texto-fraco mt-1">{erro}</p>
          <Button variant="primary" size="sm" className="mt-4" onClick={() => carregar()}>
            <Icon name="refresh" size={16} /> Tentar de novo
          </Button>
        </Card>
      ) : atual && (
        <div className={carregando ? 'opacity-60' : ''}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
            <StatCard label="Receita (pago)" value={brl(atual.totais.receita)} color="text-noite" icon={<Icon name="cash" size={22} />} />
            <StatCard label="Custo" value={brl(atual.totais.custo)} color="text-amber-700" icon={<Icon name="tag" size={22} />} />
            <StatCard label="Lucro" value={brl(atual.totais.lucro)} color={atual.totais.lucro >= 0 ? 'text-verde' : 'text-escarlate'} icon={<Icon name="chart" size={22} />} />
            <StatCard label="Margem geral" value={margemTotal == null ? '—' : `${margemTotal.toFixed(1).replace('.', ',')}%`} color={corMargem(margemTotal)} hint="Lucro sobre a receita" />
          </div>

          {atual.totais.sem_custo_count > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-sm text-amber-900 flex items-start gap-2">
              <Icon name="warning" size={16} className="mt-0.5 flex-shrink-0" />
              <span>{atual.totais.sem_custo_count} produto(s) sem preço de custo cadastrado. Eles não entram no cálculo de lucro.</span>
            </div>
          )}

          {atual.itens.length === 0 ? (
            <Card>
              <EmptyState icon={<Icon name="chart" size={26} />} message="Sem vendas pagas no período" hint="Amplie o período ou limpe as datas." />
            </Card>
          ) : (
            <>
              {/* Mobile: cartões */}
              <ul className="md:hidden space-y-2">
                {atual.itens.map(i => (
                  <li key={i.id} className="bg-white rounded-2xl border border-borda shadow-sm p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-texto break-words">{i.nome}</div>
                        <div className="text-xs text-texto-fraco">{i.qtd_vendida} vendido(s) · {brl(i.preco)} cada</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`font-display text-2xl leading-none tracking-wide ${corLucro(i.lucro)}`}>{i.lucro == null ? '—' : brl(i.lucro)}</div>
                        <div className={`text-xs mt-1 ${corMargem(i.margem)}`}>{i.margem == null ? 'sem custo' : `margem ${i.margem.toFixed(1).replace('.', ',')}%`}</div>
                      </div>
                    </div>
                    <div className="flex justify-between text-xs text-texto-fraco mt-3 pt-3 border-t border-borda">
                      <span>Receita {brl(i.receita)}</span>
                      <span>Custo un. {i.preco_custo != null ? brl(i.preco_custo) : '—'}</span>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Desktop: tabela */}
              <div className="hidden md:block bg-white rounded-2xl border border-borda shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-fundo-elevado border-b border-borda text-texto-fraco">
                      <th className="px-4 py-3 text-left text-xs font-medium">Produto</th>
                      <th className="px-4 py-3 text-right text-xs font-medium">Qtd</th>
                      <th className="px-4 py-3 text-right text-xs font-medium">Preço</th>
                      <th className="px-4 py-3 text-right text-xs font-medium">Custo un.</th>
                      <th className="px-4 py-3 text-right text-xs font-medium">Receita</th>
                      <th className="px-4 py-3 text-right text-xs font-medium">Lucro</th>
                      <th className="px-4 py-3 text-right text-xs font-medium">Margem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {atual.itens.map(i => (
                      <tr key={i.id} className="border-b border-borda/60 last:border-0 hover:bg-fundo">
                        <td className="px-4 py-3 font-medium">{i.nome}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{i.qtd_vendida}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{brl(i.preco)}</td>
                        <td className="px-4 py-3 text-right text-texto-fraco tabular-nums">{i.preco_custo != null ? brl(i.preco_custo) : '—'}</td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums">{brl(i.receita)}</td>
                        <td className={`px-4 py-3 text-right font-medium tabular-nums ${corLucro(i.lucro)}`}>{i.lucro == null ? '—' : brl(i.lucro)}</td>
                        <td className={`px-4 py-3 text-right tabular-nums ${corMargem(i.margem)}`}>{i.margem == null ? '—' : `${i.margem.toFixed(1).replace('.', ',')}%`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </AppLayout>
  );
}
