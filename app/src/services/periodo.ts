// Filtro de período (datas em YYYY-MM-DD no fuso de Brasília). Vazio = sem limite.
export interface Periodo {
  de: string;
  ate: string;
}

const TZ = 'America/Sao_Paulo';

// YYYY-MM-DD de um Date no fuso de Brasília
export function dataLocal(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: TZ });
}

// created_at do banco vem em UTC ("YYYY-MM-DD HH:MM:SS")
export function dataLocalDoBanco(createdAt: string): string {
  return dataLocal(new Date(createdAt.replace(' ', 'T') + 'Z'));
}

export function noPeriodo(data: string, p: Periodo): boolean {
  if (p.de && data < p.de) return false;
  if (p.ate && data > p.ate) return false;
  return true;
}

// Referência mensal (YYYY-MM): entra se o mês cruza o período
export function mesNoPeriodo(ref: string, p: Periodo): boolean {
  if (p.de && ref < p.de.slice(0, 7)) return false;
  if (p.ate && ref > p.ate.slice(0, 7)) return false;
  return true;
}

export type AtalhoPeriodo = 'mes' | 'mes_passado' | '30d' | 'tudo';

export function periodoDoAtalho(a: AtalhoPeriodo): Periodo {
  const hoje = dataLocal(new Date());
  const [ano, mes] = hoje.split('-').map(Number);
  const pad = (n: number) => String(n).padStart(2, '0');
  if (a === 'mes') return { de: `${ano}-${pad(mes)}-01`, ate: hoje };
  if (a === 'mes_passado') {
    const anoP = mes === 1 ? ano - 1 : ano;
    const mesP = mes === 1 ? 12 : mes - 1;
    const ultimoDia = new Date(Date.UTC(anoP, mesP, 0)).getUTCDate();
    return { de: `${anoP}-${pad(mesP)}-01`, ate: `${anoP}-${pad(mesP)}-${pad(ultimoDia)}` };
  }
  if (a === '30d') {
    const d = new Date(`${hoje}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 29);
    return { de: d.toISOString().slice(0, 10), ate: hoje };
  }
  return { de: '', ate: '' };
}

export function atalhoAtivo(p: Periodo): AtalhoPeriodo | null {
  for (const a of ['mes', 'mes_passado', '30d', 'tudo'] as AtalhoPeriodo[]) {
    const q = periodoDoAtalho(a);
    if (q.de === p.de && q.ate === p.ate) return a;
  }
  return null;
}

export function periodoAtivo(p: Periodo): boolean {
  return !!(p.de || p.ate);
}

const fmtBR = (d: string) => d.split('-').reverse().join('/');

export function descreverPeriodo(p: Periodo): string {
  if (p.de && p.ate) return `${fmtBR(p.de)} a ${fmtBR(p.ate)}`;
  if (p.de) return `a partir de ${fmtBR(p.de)}`;
  if (p.ate) return `até ${fmtBR(p.ate)}`;
  return 'todo o período';
}

// Leitura/escrita do período na URL (?de=&ate=), para manter entre telas
export function periodoDaUrl(params: URLSearchParams): Periodo {
  const valido = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '');
  return { de: valido(params.get('de')), ate: valido(params.get('ate')) };
}

export function periodoParaQuery(p: Periodo): string {
  const q = new URLSearchParams();
  if (p.de) q.set('de', p.de);
  if (p.ate) q.set('ate', p.ate);
  const s = q.toString();
  return s ? `?${s}` : '';
}
