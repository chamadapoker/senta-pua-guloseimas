import { useEffect, useState } from 'react';
import { AppLayout } from '../../components/AppLayout';
import { BackButton } from '../../components/ui/BackButton';
import { api } from '../../services/api';

interface Origem { pago: number; pendente: number; qtd_pago: number }
interface Saida  { total: number; qtd: number }

interface Data {
  entradas: { cantina: Origem; loja: Origem; cafe: Origem; ximboca: Origem };
  saidas:   { cafe: Saida; ximboca: Saida };
  totais:   { entrada: number; saida: number; saldo: number; pendente: number; previsto: number };
  periodo:  { de: string | null; ate: string | null };
}

export function CaixaConsolidado() {
  const [data, setData] = useState<Data | null>(null);
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');

  const carregar = () => {
    const qs = new URLSearchParams();
    if (de) qs.set('de', de);
    if (ate) qs.set('ate', ate);
    api.get<Data>(`/api/admin/caixa-consolidado${qs.toString() ? '?' + qs : ''}`).then(setData);
  };

  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, []);

  const hoje = () => {
    const d = new Date().toISOString().slice(0, 10);
    setDe(d); setAte(d); setTimeout(carregar, 0);
  };
  const mes = () => {
    const d = new Date();
    const ini = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    const hoje = d.toISOString().slice(0, 10);
    setDe(ini); setAte(hoje); setTimeout(carregar, 0);
  };

  return (
    <AppLayout>
      <BackButton to="/admin" className="mb-3" />
      <h1 className="font-display text-2xl text-azul tracking-wider mb-4">CAIXA CONSOLIDADO</h1>

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
        <button onClick={hoje} className="px-3 py-1.5 rounded-lg bg-fundo border border-borda text-sm">Hoje</button>
        <button onClick={mes} className="px-3 py-1.5 rounded-lg bg-fundo border border-borda text-sm">Este mês</button>
        <button onClick={() => { setDe(''); setAte(''); setTimeout(carregar, 0); }} className="px-3 py-1.5 rounded-lg bg-fundo border border-borda text-sm">Tudo</button>
      </div>

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
            <div className="bg-green-50 rounded-xl p-3 border border-green-200 text-center">
              <div className="text-[10px] text-verde-escuro uppercase tracking-wider">Entrou</div>
              <div className="font-display text-lg text-verde-escuro">R$ {data.totais.entrada.toFixed(2)}</div>
            </div>
            <div className="bg-red-50 rounded-xl p-3 border border-red-200 text-center">
              <div className="text-[10px] text-vermelho uppercase tracking-wider">Saiu</div>
              <div className="font-display text-lg text-vermelho">R$ {data.totais.saida.toFixed(2)}</div>
            </div>
            <div className={`rounded-xl p-3 border text-center ${data.totais.saldo >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'}`}>
              <div className="text-[10px] uppercase tracking-wider text-texto-fraco">Saldo</div>
              <div className={`font-display text-lg ${data.totais.saldo >= 0 ? 'text-azul' : 'text-vermelho'}`}>R$ {data.totais.saldo.toFixed(2)}</div>
            </div>
            <div className="bg-amber-50 rounded-xl p-3 border border-amber-200 text-center">
              <div className="text-[10px] text-amber-800 uppercase tracking-wider">Pendente</div>
              <div className="font-display text-lg text-amber-700">R$ {data.totais.pendente.toFixed(2)}</div>
            </div>
            <div className="bg-white rounded-xl p-3 border border-borda text-center">
              <div className="text-[10px] text-texto-fraco uppercase tracking-wider">Previsto</div>
              <div className="font-display text-lg text-azul">R$ {data.totais.previsto.toFixed(2)}</div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-borda overflow-x-auto mb-4">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="bg-azul">
                  <th className="px-3 py-2 text-left text-white font-medium">Origem</th>
                  <th className="px-3 py-2 text-right text-white font-medium">Recebido</th>
                  <th className="px-3 py-2 text-center text-white font-medium">Qtd</th>
                  <th className="px-3 py-2 text-right text-white font-medium">Pendente</th>
                </tr>
              </thead>
              <tbody>
                {(['cantina','loja','cafe','ximboca'] as const).map(k => (
                  <tr key={k}>
                    <td className="px-3 py-2 capitalize">{k}</td>
                    <td className="px-3 py-2 text-right font-medium text-verde-escuro">R$ {data.entradas[k].pago.toFixed(2)}</td>
                    <td className="px-3 py-2 text-center text-xs text-texto-fraco">{data.entradas[k].qtd_pago}</td>
                    <td className="px-3 py-2 text-right text-vermelho">R$ {data.entradas[k].pendente.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="font-bold">
                <tr className="bg-fundo">
                  <td className="px-3 py-2">TOTAL</td>
                  <td className="px-3 py-2 text-right text-verde-escuro">R$ {data.totais.entrada.toFixed(2)}</td>
                  <td className="px-3 py-2"></td>
                  <td className="px-3 py-2 text-right text-vermelho">R$ {data.totais.pendente.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="bg-white rounded-xl border border-borda overflow-x-auto">
            <table className="w-full text-sm min-w-[400px]">
              <thead>
                <tr className="bg-azul">
                  <th className="px-3 py-2 text-left text-white font-medium">Saídas por origem</th>
                  <th className="px-3 py-2 text-right text-white font-medium">Valor</th>
                  <th className="px-3 py-2 text-center text-white font-medium">Qtd</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-3 py-2">Café (compras)</td>
                  <td className="px-3 py-2 text-right text-vermelho">R$ {data.saidas.cafe.total.toFixed(2)}</td>
                  <td className="px-3 py-2 text-center text-xs text-texto-fraco">{data.saidas.cafe.qtd}</td>
                </tr>
                <tr>
                  <td className="px-3 py-2">Ximboca (despesas)</td>
                  <td className="px-3 py-2 text-right text-vermelho">R$ {data.saidas.ximboca.total.toFixed(2)}</td>
                  <td className="px-3 py-2 text-center text-xs text-texto-fraco">{data.saidas.ximboca.qtd}</td>
                </tr>
              </tbody>
              <tfoot className="font-bold">
                <tr className="bg-fundo">
                  <td className="px-3 py-2">TOTAL</td>
                  <td className="px-3 py-2 text-right text-vermelho">R$ {data.totais.saida.toFixed(2)}</td>
                  <td className="px-3 py-2"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </AppLayout>
  );
}
