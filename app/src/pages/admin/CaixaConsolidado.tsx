import { useEffect, useState } from 'react';
import { AppLayout } from '../../components/AppLayout';
import { BackButton } from '../../components/ui/BackButton';
import { PageHeader } from '../../components/ui/PageHeader';
import { api } from '../../services/api';
import { dataLocal, periodoDoAtalho } from '../../services/periodo';
import { useToast } from '../../hooks/useToast';
import { Loading } from '../../components/ui/Loading';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Icon } from '../../components/ui/Icon';
import { inputClass } from '../../components/ui/Field';
import { StatCard } from '../../components/admin/StatCard';

interface Origem { pago: number; pendente: number; qtd_pago: number }
interface Saida  { total: number; qtd: number }

interface Data {
  entradas: { cantina: Origem; loja: Origem; cafe: Origem; ximboca: Origem };
  saidas:   { cafe: Saida; ximboca: Saida };
  totais:   { entrada: number; saida: number; saldo: number; pendente: number; previsto: number };
  periodo:  { de: string | null; ate: string | null };
}

const brl = (v: number) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const ORIGENS = [['cantina', 'Cantina'], ['loja', 'Loja'], ['cafe', 'Café'], ['ximboca', 'Ximboca']] as const;

export function CaixaConsolidado() {
  const [data, setData] = useState<Data | null>(null);
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const { showToast } = useToast();

  // Recebe o período explicitamente: evita ler estado velho logo após setDe/setAte.
  const carregar = (p: { de: string; ate: string } = { de, ate }) => {
    const qs = new URLSearchParams();
    if (p.de) qs.set('de', p.de);
    if (p.ate) qs.set('ate', p.ate);
    setCarregando(true);
    setErro('');
    api.get<Data>(`/api/admin/caixa-consolidado${qs.toString() ? '?' + qs : ''}`)
      .then(setData)
      .catch((e: any) => {
        const msg = e?.message || 'Erro ao carregar caixa';
        setErro(msg);
        showToast(msg, 'error');
      })
      .finally(() => setCarregando(false));
  };

  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, []);

  const aplicarPeriodo = (p: { de: string; ate: string }) => { setDe(p.de); setAte(p.ate); carregar(p); };
  const hojeStr = dataLocal(new Date());
  const hoje = () => aplicarPeriodo({ de: hojeStr, ate: hojeStr });
  const mesP = periodoDoAtalho('mes');
  const mes = () => aplicarPeriodo(mesP);

  const atalho = !de && !ate ? 'tudo' : de === hojeStr && ate === hojeStr ? 'hoje' : de === mesP.de && ate === mesP.ate ? 'mes' : null;

  return (
    <AppLayout>
      <BackButton to="/admin" className="mb-3" />
      <PageHeader title="Caixa consolidado" subtitle="O que entrou, saiu e ainda falta receber em todas as áreas." />

      <form
        onSubmit={(e) => { e.preventDefault(); carregar(); }}
        className="bg-white rounded-2xl border border-borda shadow-sm p-3 sm:p-4 mb-5"
      >
        <div className="flex gap-1.5 flex-wrap mb-3" role="group" aria-label="Atalhos de período">
          <Button size="xs" variant={atalho === 'hoje' ? 'chip-primary' : 'chip'} aria-pressed={atalho === 'hoje'} onClick={hoje}>Hoje</Button>
          <Button size="xs" variant={atalho === 'mes' ? 'chip-primary' : 'chip'} aria-pressed={atalho === 'mes'} onClick={mes}>Este mês</Button>
          <Button size="xs" variant={atalho === 'tudo' ? 'chip-primary' : 'chip'} aria-pressed={atalho === 'tudo'} onClick={() => aplicarPeriodo({ de: '', ate: '' })}>Tudo</Button>
        </div>
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-3 sm:items-end">
          <div className="min-w-0">
            <label htmlFor="cx-de" className="block text-sm font-medium mb-1.5">De</label>
            <input id="cx-de" type="date" value={de} onChange={e => setDe(e.target.value)} className={`${inputClass} min-h-[44px]`} />
          </div>
          <div className="min-w-0">
            <label htmlFor="cx-ate" className="block text-sm font-medium mb-1.5">Até</label>
            <input id="cx-ate" type="date" value={ate} onChange={e => setAte(e.target.value)} className={`${inputClass} min-h-[44px]`} />
          </div>
          <Button type="submit" className="col-span-2 sm:col-span-1">Aplicar período</Button>
        </div>
      </form>

      {!data && carregando && <Loading label="Carregando caixa..." />}

      {!data && !carregando && erro && (
        <Card className="text-center py-8">
          <p className="text-[15px] font-medium text-texto">Não foi possível carregar o caixa.</p>
          <p className="text-sm text-texto-fraco mt-1">{erro}</p>
          <Button variant="primary" size="sm" className="mt-4" onClick={() => carregar()}>
            <Icon name="refresh" size={16} /> Tentar de novo
          </Button>
        </Card>
      )}

      {data && (
        <div className={carregando ? 'opacity-60' : ''}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-3">
            <StatCard label="Entrou" value={brl(data.totais.entrada)} color="text-verde" icon={<Icon name="download" size={22} />} />
            <StatCard label="Saiu" value={brl(data.totais.saida)} color="text-escarlate" icon={<Icon name="upload" size={22} />} />
            <StatCard label="Saldo" value={brl(data.totais.saldo)} color={data.totais.saldo >= 0 ? 'text-noite' : 'text-escarlate'} icon={<Icon name="vault" size={22} />} hint="Entrou menos saiu" />
            <StatCard label="A receber" value={brl(data.totais.pendente)} color="text-amber-700" icon={<Icon name="clock" size={22} />} />
          </div>
          <p className="text-sm text-texto-fraco mb-6">
            Previsto (saldo mais o que falta receber): <strong className="font-display text-xl tracking-wide text-azul">{brl(data.totais.previsto)}</strong>
          </p>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="bg-white rounded-2xl border border-borda shadow-sm overflow-hidden min-w-0">
              <div className="px-5 pt-5 pb-3">
                <h2 className="text-base font-semibold text-noite">Entradas por área</h2>
                <p className="text-xs text-texto-fraco">Recebido e pendente em cada área.</p>
              </div>
              <ul className="divide-y divide-borda border-t border-borda">
                {ORIGENS.map(([k, nome]) => (
                  <li key={k} className="flex items-center justify-between gap-3 px-5 py-3">
                    <span className="min-w-0">
                      <span className="block font-medium text-texto">{nome}</span>
                      <span className="block text-xs text-texto-fraco">{data.entradas[k].qtd_pago} pagamento(s)</span>
                    </span>
                    <span className="text-right shrink-0">
                      <span className="block font-semibold text-verde-escuro tabular-nums">{brl(data.entradas[k].pago)}</span>
                      <span className={`block text-xs tabular-nums ${data.entradas[k].pendente > 0 ? 'text-amber-700' : 'text-texto-fraco'}`}>
                        {brl(data.entradas[k].pendente)} pendente
                      </span>
                    </span>
                  </li>
                ))}
                <li className="flex items-center justify-between gap-3 px-5 py-3 bg-fundo-elevado">
                  <span className="font-semibold text-texto">Total</span>
                  <span className="text-right">
                    <span className="block font-semibold text-verde-escuro tabular-nums">{brl(data.totais.entrada)}</span>
                    <span className="block text-xs text-amber-700 tabular-nums">{brl(data.totais.pendente)} pendente</span>
                  </span>
                </li>
              </ul>
            </section>

            <section className="bg-white rounded-2xl border border-borda shadow-sm overflow-hidden min-w-0 self-start">
              <div className="px-5 pt-5 pb-3">
                <h2 className="text-base font-semibold text-noite">Saídas</h2>
                <p className="text-xs text-texto-fraco">Compras e despesas registradas.</p>
              </div>
              <ul className="divide-y divide-borda border-t border-borda">
                <li className="flex items-center justify-between gap-3 px-5 py-3">
                  <span className="min-w-0">
                    <span className="block font-medium text-texto">Café (compras)</span>
                    <span className="block text-xs text-texto-fraco">{data.saidas.cafe.qtd} lançamento(s)</span>
                  </span>
                  <span className="font-semibold text-escarlate tabular-nums shrink-0">{brl(data.saidas.cafe.total)}</span>
                </li>
                <li className="flex items-center justify-between gap-3 px-5 py-3">
                  <span className="min-w-0">
                    <span className="block font-medium text-texto">Ximboca (despesas)</span>
                    <span className="block text-xs text-texto-fraco">{data.saidas.ximboca.qtd} lançamento(s)</span>
                  </span>
                  <span className="font-semibold text-escarlate tabular-nums shrink-0">{brl(data.saidas.ximboca.total)}</span>
                </li>
                <li className="flex items-center justify-between gap-3 px-5 py-3 bg-fundo-elevado">
                  <span className="font-semibold text-texto">Total</span>
                  <span className="font-semibold text-escarlate tabular-nums">{brl(data.totais.saida)}</span>
                </li>
              </ul>
            </section>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
