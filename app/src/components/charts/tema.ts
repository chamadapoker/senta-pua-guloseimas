// Cores dos gráficos. Validadas com o validador de paleta (daltonismo e contraste):
// a ordem azul → laranja → água → âmbar passa para pares vizinhos; nunca ponha as 4 áreas
// num mesmo gráfico sem legenda em texto. Âmbar e água têm contraste baixo no branco,
// por isso os gráficos que usam essas cores sempre mostram rótulos ou a visão em tabela.
export const COR_AREA = {
  cantina: '#2a78d6',
  ximboca: '#eb6834',
  loja: '#1baf7a',
  cafe: '#eda100',
} as const;

export const NOME_AREA: Record<keyof typeof COR_AREA, string> = {
  cantina: 'Cantina',
  ximboca: 'Ximboca',
  loja: 'Loja',
  cafe: 'Café',
};

// Status (reservado: sempre com rótulo em texto). Verde escuro + âmbar: o verde claro com âmbar
// falhou no teste de protanopia (ΔE 4,8); este par passa (ΔE 26). Âmbar pede rótulo/tabela.
export const COR_STATUS = {
  pago: '#166534',
  pendente: '#eda100',
} as const;

// Sequencial (uma só cor, claro → escuro) para a idade da dívida
export const RAMPA_DIVIDA = ['#f6b9b9', '#eb7b7a', '#d23f3e', '#951c1c'];

// Tinta de texto e estrutura (nunca na cor da série)
export const TINTA = {
  forte: '#1a1a1a',
  fraca: '#6b7280',
  grade: '#e7eaf0',
  eixo: '#cbd2de',
  superficie: '#ffffff',
};

export const brl = (v: number) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const brlCurto = (v: number) => {
  const a = Math.abs(v);
  if (a >= 1000) return `R$ ${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  return `R$ ${Math.round(v).toLocaleString('pt-BR')}`;
};

// Eixos recessivos, iguais em todos os gráficos
export const eixoProps = {
  tick: { fontSize: 11, fill: TINTA.fraca },
  axisLine: false,
  tickLine: false,
} as const;

// Lista de dias (YYYY-MM-DD) do período, terminando hoje em Brasília, para preencher dias sem venda com zero
export function diasDoPeriodo(n: number): string[] {
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const base = new Date(`${hoje}T12:00:00Z`);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export const rotuloDia = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  return n <= 7
    ? d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', timeZone: 'UTC' }).replace('.', '')
    : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });
};

export const rotuloMes = (ym: string) => {
  const [a, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, 15)).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' }).replace('.', '');
};
