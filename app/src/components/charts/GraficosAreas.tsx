import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartCard, TooltipNoite } from './ChartCard';
import { COR_AREA, COR_STATUS, TINTA, brlCurto, eixoProps, rotuloMes } from './tema';
import { usePainel } from './PainelGeral';

const carregando = <div className="h-[280px] rounded-2xl bg-white border border-borda animate-pulse" aria-busy="true" />;
const falhou = (titulo: string) => (
  <ChartCard titulo={titulo} vazio textoVazio="Não foi possível carregar o gráfico. Recarregue a página para tentar de novo."><span /></ChartCard>
);

// Loja: vendido por mês (últimos 6). Série única na cor da loja, com valor escrito em cima de cada barra
export function GraficoLojaMeses() {
  const { dados, erro } = usePainel(30);
  if (erro) return falhou('Vendas da loja por mês');
  if (!dados) return carregando;
  const linhas = dados.loja_meses.map(m => ({ ...m, rotulo: rotuloMes(m.mes) }));
  return (
    <ChartCard
      titulo="Vendas da loja por mês"
      subtitulo="Total dos pedidos nos últimos 6 meses, pela data do pedido."
      vazio={linhas.length === 0}
      textoVazio="Ainda não há pedidos na loja."
      tabela={{ colunas: ['Mês', 'Pedidos', 'Vendido'], linhas: linhas.map(l => ({ rotulo: l.rotulo, valores: [String(l.qtd), l.valor] })) }}
    >
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={linhas} margin={{ top: 22, right: 4, left: 0, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid stroke={TINTA.grade} vertical={false} />
          <XAxis dataKey="rotulo" {...eixoProps} />
          <YAxis {...eixoProps} width={64} tickFormatter={brlCurto} />
          <Tooltip content={<TooltipNoite />} cursor={{ fill: 'rgba(13,22,64,0.05)' }} />
          <Bar dataKey="valor" name="Vendido" fill={COR_AREA.loja} radius={[4, 4, 0, 0]} maxBarSize={48}>
            <LabelList dataKey="valor" position="top" fontSize={11} fill={TINTA.forte} formatter={(v: number) => (v ? brlCurto(v) : '')} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// Café: mensalidades por mês de referência, pago × pendente, sempre de UMA sala (são públicos diferentes)
export function GraficoCafeMeses({ tipo }: { tipo: 'oficial' | 'graduado' }) {
  const { dados, erro } = usePainel(30, tipo);
  const sala = tipo === 'oficial' ? 'Sala dos oficiais' : 'Sala dos graduados';
  if (erro) return falhou(`Mensalidades · ${sala}`);
  if (!dados) return carregando;
  const linhas = dados.cafe_meses.map(m => ({ ...m, rotulo: rotuloMes(m.mes) }));
  return (
    <ChartCard
      titulo={`Mensalidades · ${sala}`}
      subtitulo="Quanto já foi pago e quanto falta em cada mês de referência."
      legenda={[{ cor: COR_STATUS.pago, nome: 'Pago' }, { cor: COR_STATUS.pendente, nome: 'Pendente' }]}
      vazio={linhas.length === 0}
      textoVazio="Nenhuma mensalidade gerada para esta sala ainda."
      tabela={{ colunas: ['Mês', 'Pago', 'Pendente'], linhas: linhas.map(l => ({ rotulo: l.rotulo, valores: [l.pago, l.pendente] })) }}
    >
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={linhas} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid stroke={TINTA.grade} vertical={false} />
          <XAxis dataKey="rotulo" {...eixoProps} />
          <YAxis {...eixoProps} width={64} tickFormatter={brlCurto} />
          <Tooltip content={<TooltipNoite />} cursor={{ fill: 'rgba(13,22,64,0.05)' }} />
          <Bar dataKey="pago" name="Pago" stackId="m" fill={COR_STATUS.pago} stroke={TINTA.superficie} strokeWidth={1} maxBarSize={48} />
          <Bar dataKey="pendente" name="Pendente" stackId="m" fill={COR_STATUS.pendente} stroke={TINTA.superficie} strokeWidth={1} radius={[4, 4, 0, 0]} maxBarSize={48} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// Ximboca: arrecadado × gasto por evento (barras lado a lado, uma escala só)
interface EventoResumo { id: string; nome: string; data: string; total_arrecadado: number; total_despesas: number }
export function GraficoXimbocaEventos({ eventos }: { eventos: EventoResumo[] }) {
  const linhas = [...eventos]
    .sort((a, b) => a.data.localeCompare(b.data))
    .slice(-6)
    .map(e => ({
      rotulo: e.nome.length > 14 ? `${e.nome.slice(0, 13)}…` : e.nome,
      nome: e.nome,
      arrecadado: e.total_arrecadado || 0,
      gasto: e.total_despesas || 0,
    }));
  return (
    <ChartCard
      titulo="Arrecadado e gasto por evento"
      subtitulo="Os 6 eventos mais recentes."
      legenda={[{ cor: COR_AREA.cantina, nome: 'Arrecadado' }, { cor: COR_AREA.ximboca, nome: 'Gasto' }]}
      vazio={linhas.length === 0}
      textoVazio="Nenhum evento ainda."
      tabela={{ colunas: ['Evento', 'Arrecadado', 'Gasto', 'Saldo'], linhas: linhas.map(l => ({ rotulo: l.nome, valores: [l.arrecadado, l.gasto, l.arrecadado - l.gasto] })) }}
      className="mb-6"
    >
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={linhas} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="24%" barGap={2}>
          <CartesianGrid stroke={TINTA.grade} vertical={false} />
          <XAxis dataKey="rotulo" {...eixoProps} interval={0} />
          <YAxis {...eixoProps} width={64} tickFormatter={brlCurto} />
          <Tooltip
            content={<TooltipNoite rotulo={(_l, p) => String(p?.[0]?.payload?.nome ?? _l)} />}
            cursor={{ fill: 'rgba(13,22,64,0.05)' }}
          />
          <Bar dataKey="arrecadado" name="Arrecadado" fill={COR_AREA.cantina} radius={[4, 4, 0, 0]} maxBarSize={36} />
          <Bar dataKey="gasto" name="Gasto" fill={COR_AREA.ximboca} radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
