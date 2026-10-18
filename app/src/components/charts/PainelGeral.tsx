import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../../services/api';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/Button';
import { StatCard } from '../admin/StatCard';
import { ChartCard, TooltipNoite, BarrasHorizontais } from './ChartCard';
import { COR_AREA, NOME_AREA, RAMPA_DIVIDA, TINTA, brl, brlCurto, diasDoPeriodo, eixoProps, rotuloDia } from './tema';

interface Ponto { dia: string; valor: number; qtd?: number }
export interface PainelDados {
  dias: number;
  series: { cantina: Ponto[]; loja: Ponto[]; cafe: Ponto[]; recebido: Ponto[] };
  anterior: { cantina: number; loja: number; cafe: number };
  por_hora: { hora: number; qtd: number; valor: number }[];
  aging: { faixa: number; qtd: number; valor: number }[];
  metodos: { metodo: string; qtd: number; valor: number }[];
  top_produtos: { nome: string; qtd: number; valor: number }[];
  cafe_meses: { mes: string; pago: number; pendente: number }[];
  loja_meses: { mes: string; valor: number; qtd: number }[];
}

const PERIODOS = [7, 30, 90] as const;
const FAIXAS = ['Até 7 dias', '8 a 30 dias', '31 a 60 dias', 'Mais de 60 dias'];
const NOME_METODO: Record<string, string> = { pix: 'PIX', dinheiro: 'Dinheiro', fiado: 'Fiado' };
// Cores próprias (não reaproveitar as das áreas: a cor segue a entidade). Validado em todos os pares;
// verde×vermelho fica na faixa de alerta (ΔE 7,2), por isso cada forma sempre vem com nome, valor e %.
const COR_METODO: Record<string, string> = { pix: '#6250d6', dinheiro: '#008300', fiado: '#e34948' };

const soma = (p: Ponto[]) => p.reduce((s, x) => s + x.valor, 0);

function variacao(atual: number, anterior: number): string | undefined {
  if (!anterior) return atual > 0 ? 'Sem vendas no período anterior' : undefined;
  const pct = ((atual - anterior) / anterior) * 100;
  const sinal = pct > 0 ? '+' : '';
  return `${sinal}${pct.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}% vs. período anterior`;
}

export function usePainel(dias: number, cafeTipo?: 'oficial' | 'graduado') {
  const [dados, setDados] = useState<PainelDados | null>(null);
  const [erro, setErro] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  useEffect(() => {
    let ativo = true;
    setErro(false);
    const qs = new URLSearchParams({ dias: String(dias) });
    if (cafeTipo) qs.set('cafe_tipo', cafeTipo);
    api.get<PainelDados>(`/api/admin/painel?${qs}`)
      .then(d => { if (ativo) setDados(d); })
      .catch(() => { if (ativo) setErro(true); });
    return () => { ativo = false; };
  }, [dias, cafeTipo, tentativa]);
  return { dados, erro, recarregar: () => setTentativa(n => n + 1) };
}

export function PainelGeral() {
  const [dias, setDias] = useState<(typeof PERIODOS)[number]>(30);
  const { dados, erro, recarregar } = usePainel(dias);

  const porDia = useMemo(() => {
    if (!dados) return [];
    const mapa = (p: Ponto[]) => new Map(p.map(x => [x.dia, x.valor]));
    const c = mapa(dados.series.cantina);
    const l = mapa(dados.series.loja);
    return diasDoPeriodo(dados.dias).map(dia => ({
      dia,
      rotulo: rotuloDia(dia, dados.dias),
      cantina: c.get(dia) ?? 0,
      loja: l.get(dia) ?? 0,
    }));
  }, [dados]);

  const horas = useMemo(() => {
    if (!dados || dados.por_hora.length === 0) return [];
    const mapa = new Map(dados.por_hora.map(h => [h.hora, h]));
    const min = Math.min(...dados.por_hora.map(h => h.hora));
    const max = Math.max(...dados.por_hora.map(h => h.hora));
    const out = [];
    for (let h = min; h <= max; h++) out.push({ hora: `${h}h`, qtd: mapa.get(h)?.qtd ?? 0, valor: mapa.get(h)?.valor ?? 0 });
    return out;
  }, [dados]);
  const pico = horas.reduce((m, h) => (h.qtd > (m?.qtd ?? -1) ? h : m), null as (typeof horas)[number] | null);

  const seletor = (
    <div role="group" aria-label="Período" className="inline-flex bg-white border border-borda rounded-xl p-1 shadow-sm">
      {PERIODOS.map(p => (
        <button
          key={p}
          onClick={() => setDias(p)}
          aria-pressed={dias === p}
          className={`h-9 px-3.5 rounded-lg text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-azul/40 ${
            dias === p ? 'bg-noite text-white' : 'text-texto-fraco hover:text-texto'
          }`}
        >
          {p} dias
        </button>
      ))}
    </div>
  );

  const cabecalho = (
    <div className="flex items-end justify-between gap-3 flex-wrap mb-4">
      <div>
        <h2 className="font-display text-2xl leading-none tracking-wide text-noite">Visão geral</h2>
        <p className="text-sm text-texto-fraco mt-1">Cantina, loja e café nos últimos {dias} dias, no horário de Brasília.</p>
      </div>
      {seletor}
    </div>
  );

  if (erro) {
    return (
      <section className="mb-8">
        {cabecalho}
        <div className="bg-white border border-borda rounded-2xl p-6 text-center">
          <p className="text-[15px] font-medium text-texto">Não foi possível carregar os gráficos.</p>
          <Button variant="primary" size="sm" className="mt-4" onClick={recarregar}><Icon name="refresh" size={16} /> Tentar de novo</Button>
        </div>
      </section>
    );
  }

  if (!dados) {
    return (
      <section className="mb-8" aria-busy="true">
        {cabecalho}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
          {[0, 1, 2, 3].map(i => <div key={i} className="h-[112px] rounded-2xl bg-white border border-borda animate-pulse" />)}
        </div>
        <div className="h-[300px] rounded-2xl bg-white border border-borda animate-pulse" />
      </section>
    );
  }

  const tCantina = soma(dados.series.cantina);
  const tLoja = soma(dados.series.loja);
  const tCafe = soma(dados.series.cafe);
  const tRecebido = soma(dados.series.recebido) + tCafe;
  const tDivida = dados.aging.reduce((s, a) => s + a.valor, 0);
  const divida60 = dados.aging.filter(a => a.faixa >= 3).reduce((s, a) => s + a.valor, 0);
  const totalMetodos = dados.metodos.reduce((s, m) => s + m.valor, 0);

  return (
    <section className="mb-8" aria-labelledby="visao-geral">
      <span id="visao-geral" className="sr-only">Visão geral</span>
      {cabecalho}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
        <StatCard label="Vendido na cantina" value={brl(tCantina)} color="text-noite" icon={<Icon name="cutlery" size={20} />} hint={variacao(tCantina, dados.anterior.cantina)} />
        <StatCard label="Vendido na loja" value={brl(tLoja)} color="text-noite" icon={<Icon name="bag" size={20} />} hint={variacao(tLoja, dados.anterior.loja)} />
        <StatCard label="Dinheiro que entrou" value={brl(tRecebido)} color="text-verde-escuro" icon={<Icon name="check" size={20} />} hint="Pagamentos confirmados no período, com café" />
        <StatCard label="Dívida em aberto" value={brl(tDivida)} color={tDivida > 0 ? 'text-escarlate' : 'text-verde-escuro'} icon={<Icon name="clock" size={20} />} hint={divida60 > 0 ? `${brl(divida60)} com mais de 30 dias` : 'Nada atrasado há mais de 30 dias'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Vendas por dia, empilhado cantina + loja */}
        <ChartCard
          className="lg:col-span-2"
          titulo="Vendas por dia"
          subtitulo="Cantina e loja somadas, pela data do pedido."
          legenda={[{ cor: COR_AREA.cantina, nome: NOME_AREA.cantina }, { cor: COR_AREA.loja, nome: NOME_AREA.loja }]}
          vazio={tCantina + tLoja === 0}
          textoVazio="Nenhuma venda no período."
          tabela={{ colunas: ['Dia', 'Cantina', 'Loja'], linhas: porDia.filter(d => d.cantina + d.loja > 0).map(d => ({ rotulo: d.rotulo, valores: [d.cantina, d.loja] })) }}
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={porDia} barCategoryGap={dados.dias > 30 ? '12%' : '22%'} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={TINTA.grade} vertical={false} />
              <XAxis dataKey="rotulo" {...eixoProps} interval="preserveStartEnd" minTickGap={18} />
              <YAxis {...eixoProps} width={64} tickFormatter={brlCurto} />
              <Tooltip content={<TooltipNoite />} cursor={{ fill: 'rgba(13,22,64,0.05)' }} />
              <Bar dataKey="cantina" name="Cantina" stackId="v" fill={COR_AREA.cantina} stroke={TINTA.superficie} strokeWidth={1} maxBarSize={36} />
              <Bar dataKey="loja" name="Loja" stackId="v" fill={COR_AREA.loja} stroke={TINTA.superficie} strokeWidth={1} radius={[4, 4, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Idade da dívida */}
        <ChartCard
          titulo="Idade da dívida"
          subtitulo="Fiado e pendentes de cantina e loja, pelo tempo em aberto."
          vazio={tDivida === 0}
          textoVazio="Ninguém devendo. Bom trabalho."
        >
          <BarrasHorizontais
            cor={RAMPA_DIVIDA[2]}
            itens={FAIXAS.map((rotulo, i) => {
              const a = dados.aging.find(x => x.faixa === i + 1);
              return { rotulo, valor: a?.valor ?? 0, detalhe: a ? `${a.qtd} ped.` : undefined, cor: RAMPA_DIVIDA[i] };
            })}
          />
          {divida60 > 0 && (
            <p className="text-xs text-texto-fraco mt-4">
              Comece a cobrança pelas faixas mais escuras: são as mais antigas.
            </p>
          )}
        </ChartCard>

        {/* Horário de pico */}
        <ChartCard
          titulo="Horário de pico da cantina"
          subtitulo={pico ? `Mais pedidos às ${pico.hora} (${pico.qtd} no período).` : 'Pedidos por hora do dia.'}
          vazio={horas.length === 0}
          textoVazio="Sem pedidos no período."
          tabela={{ colunas: ['Hora', 'Pedidos', 'Valor'], linhas: horas.filter(h => h.qtd).map(h => ({ rotulo: h.hora, valores: [String(h.qtd), h.valor] })) }}
        >
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={horas} margin={{ top: 18, right: 4, left: 0, bottom: 0 }} barCategoryGap="18%">
              <CartesianGrid stroke={TINTA.grade} vertical={false} />
              <XAxis dataKey="hora" {...eixoProps} interval="preserveStartEnd" />
              <YAxis {...eixoProps} width={28} allowDecimals={false} />
              <Tooltip content={<TooltipNoite formatarValor={v => `${v} pedido${v === 1 ? '' : 's'}`} />} cursor={{ fill: 'rgba(13,22,64,0.05)' }} />
              <Bar dataKey="qtd" name="Pedidos" radius={[4, 4, 0, 0]} maxBarSize={28}>
                {horas.map(h => <Cell key={h.hora} fill={h === pico ? COR_AREA.cantina : '#a9c5ee'} />)}
                <LabelList dataKey="qtd" position="top" className="fill-current" fontSize={11} fill={TINTA.forte}
                  formatter={(v: number) => (pico && v === pico.qtd ? v : '')} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Formas de pagamento: barra 100% com rótulos */}
        <ChartCard
          titulo="Formas de pagamento"
          subtitulo="Pedidos da cantina no período, por valor."
          vazio={totalMetodos === 0}
          textoVazio="Sem pedidos no período."
        >
          <div className="flex h-4 rounded-full overflow-hidden gap-[2px] bg-white mb-4" role="img"
            aria-label={dados.metodos.map(m => `${NOME_METODO[m.metodo] ?? m.metodo} ${Math.round((m.valor / totalMetodos) * 100)}%`).join(', ')}>
            {dados.metodos.map(m => (
              <div key={m.metodo} style={{ width: `${(m.valor / totalMetodos) * 100}%`, backgroundColor: COR_METODO[m.metodo] ?? TINTA.fraca }} />
            ))}
          </div>
          <ul className="space-y-2">
            {dados.metodos.map(m => (
              <li key={m.metodo} className="flex items-center justify-between gap-3 text-sm">
                <span className="inline-flex items-center gap-2 text-texto">
                  <span className="w-2.5 h-2.5 rounded-[3px]" style={{ backgroundColor: COR_METODO[m.metodo] ?? TINTA.fraca }} aria-hidden="true" />
                  {NOME_METODO[m.metodo] ?? m.metodo}
                  <span className="text-xs text-texto-fraco">{m.qtd} ped.</span>
                </span>
                <span className="tabular-nums font-semibold text-texto">
                  {brl(m.valor)} <span className="text-xs text-texto-fraco font-normal">{Math.round((m.valor / totalMetodos) * 100)}%</span>
                </span>
              </li>
            ))}
          </ul>
        </ChartCard>

        {/* Mais vendidos */}
        <ChartCard
          titulo="Mais vendidos na cantina"
          subtitulo="Por valor vendido no período."
          vazio={dados.top_produtos.length === 0}
          textoVazio="Sem vendas no período."
        >
          <BarrasHorizontais
            cor={COR_AREA.cantina}
            itens={dados.top_produtos.slice(0, 6).map(p => ({ rotulo: p.nome, valor: p.valor, detalhe: `${p.qtd} un.` }))}
          />
        </ChartCard>
      </div>
    </section>
  );
}
