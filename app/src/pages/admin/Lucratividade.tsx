import { useEffect, useState } from 'react';
import { AppLayout } from '../../components/AppLayout';
import { BackButton } from '../../components/ui/BackButton';
import { api } from '../../services/api';

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

export function Lucratividade() {
  const [data, setData] = useState<DataResp | null>(null);
  const [aba, setAba] = useState<'cantina' | 'loja'>('cantina');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');

  const carregar = () => {
    const qs = new URLSearchParams();
    if (de) qs.set('de', de);
    if (ate) qs.set('ate', ate);
    api.get<DataResp>(`/api/admin/lucratividade${qs.toString() ? '?' + qs : ''}`).then(setData);
  };

  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, []);

  const atual = data?.[aba];

  return (
    <AppLayout>
      <BackButton to="/admin" className="mb-3" />
      <h1 className="font-display text-2xl text-azul tracking-wider mb-4">LUCRATIVIDADE</h1>

      <div className="bg-white rounded-xl border border-borda p-3 mb-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-[10px] text-texto-fraco uppercase mb-1">De</label>
          <input type="date" value={de} onChange={e => setDe(e.target.value)} className="bg-white border border-borda rounded-lg px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-[10px] text-texto-fraco uppercase mb-1">Até</label>
          <input type="date" value={ate} onChange={e => setAte(e.target.value)} className="bg-white border border-borda rounded-lg px-2 py-1.5 text-sm" />
        </div>
        <button onClick={carregar} className="px-4 py-1.5 rounded-lg bg-azul text-white text-sm font-medium">Aplicar</button>
        <button onClick={() => { setDe(''); setAte(''); setTimeout(carregar, 0); }} className="px-4 py-1.5 rounded-lg bg-fundo border border-borda text-sm">Limpar</button>
      </div>

      <div className="flex gap-1 bg-white rounded-xl p-1 border border-borda shadow-sm mb-4">
        <button onClick={() => setAba('cantina')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${aba === 'cantina' ? 'bg-azul text-white shadow-sm' : 'text-texto-fraco'}`}>Cantina</button>
        <button onClick={() => setAba('loja')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${aba === 'loja' ? 'bg-azul text-white shadow-sm' : 'text-texto-fraco'}`}>Loja</button>
      </div>

      {atual && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-white rounded-xl p-3 border border-borda text-center">
              <div className="text-[10px] text-texto-fraco uppercase">Receita (pago)</div>
              <div className="font-display text-lg text-azul">R$ {atual.totais.receita.toFixed(2)}</div>
            </div>
            <div className="bg-white rounded-xl p-3 border border-borda text-center">
              <div className="text-[10px] text-texto-fraco uppercase">Custo</div>
              <div className="font-display text-lg text-vermelho">R$ {atual.totais.custo.toFixed(2)}</div>
            </div>
            <div className={`rounded-xl p-3 border text-center ${atual.totais.lucro >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <div className="text-[10px] uppercase text-texto-fraco">Lucro</div>
              <div className={`font-display text-lg ${atual.totais.lucro >= 0 ? 'text-verde-escuro' : 'text-vermelho'}`}>R$ {atual.totais.lucro.toFixed(2)}</div>
            </div>
          </div>

          {atual.totais.sem_custo_count > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-xs text-amber-900">
              ⚠ {atual.totais.sem_custo_count} produto(s) sem preço de custo cadastrado — não entram no cálculo de lucro.
            </div>
          )}

          <div className="bg-white rounded-xl border border-borda overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="bg-azul">
                  <th className="px-3 py-2 text-left text-white font-medium">Produto</th>
                  <th className="px-3 py-2 text-right text-white font-medium">Qtd</th>
                  <th className="px-3 py-2 text-right text-white font-medium">Preço</th>
                  <th className="px-3 py-2 text-right text-white font-medium">Custo un.</th>
                  <th className="px-3 py-2 text-right text-white font-medium">Receita</th>
                  <th className="px-3 py-2 text-right text-white font-medium">Lucro</th>
                  <th className="px-3 py-2 text-right text-white font-medium">Margem</th>
                </tr>
              </thead>
              <tbody>
                {atual.itens.map(i => (
                  <tr key={i.id}>
                    <td className="px-3 py-2">{i.nome}</td>
                    <td className="px-3 py-2 text-right">{i.qtd_vendida}</td>
                    <td className="px-3 py-2 text-right">R$ {i.preco.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right text-texto-fraco">{i.preco_custo != null ? `R$ ${i.preco_custo.toFixed(2)}` : '—'}</td>
                    <td className="px-3 py-2 text-right font-medium">R$ {i.receita.toFixed(2)}</td>
                    <td className={`px-3 py-2 text-right font-medium ${i.lucro == null ? 'text-texto-fraco' : i.lucro >= 0 ? 'text-verde-escuro' : 'text-vermelho'}`}>
                      {i.lucro == null ? '—' : `R$ ${i.lucro.toFixed(2)}`}
                    </td>
                    <td className={`px-3 py-2 text-right text-xs ${i.margem == null ? 'text-texto-fraco' : i.margem >= 30 ? 'text-verde-escuro' : i.margem >= 0 ? 'text-amber-700' : 'text-vermelho'}`}>
                      {i.margem == null ? '—' : `${i.margem.toFixed(1)}%`}
                    </td>
                  </tr>
                ))}
                {atual.itens.length === 0 && <tr><td colSpan={7} className="text-center py-6 text-texto-fraco">Sem vendas no período</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </AppLayout>
  );
}
