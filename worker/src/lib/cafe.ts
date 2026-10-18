import type { Categoria } from './categoria';

// Regras do café: sala, períodos (mensal/anual) e status do militar

export type TipoCafe = 'oficial' | 'graduado';
export type PlanoCafe = 'mensal' | 'anual';

export const TIPOS_CAFE: TipoCafe[] = ['oficial', 'graduado'];
export const PLANOS_CAFE: PlanoCafe[] = ['mensal', 'anual'];

const MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

// Sala do café que corresponde à categoria (praça não participa)
export function tipoCafeDaCategoria(categoria: string | null | undefined): TipoCafe | null {
  if (categoria === 'oficial') return 'oficial';
  if (categoria === 'graduado') return 'graduado';
  return null;
}

export function categoriaParticipa(categoria: Categoria | string | null | undefined): boolean {
  return tipoCafeDaCategoria(categoria) !== null;
}

// Mês atual no horário de Brasília (UTC-3, sem horário de verão) -> 'YYYY-MM'
export function mesAtualBrasilia(agora: Date = new Date()): string {
  const d = new Date(agora.getTime() - 3 * 60 * 60 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

// Dia do mês no horário de Brasília
export function diaAtualBrasilia(agora: Date = new Date()): number {
  return new Date(agora.getTime() - 3 * 60 * 60 * 1000).getUTCDate();
}

// Soma n meses a 'YYYY-MM'
export function somarMeses(ym: string, n: number): string {
  const [a, m] = ym.split('-').map(Number);
  const total = a * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

export function ehMesValido(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
}

// Pagamento é anuidade? (novo: tem periodo_fim; antigo: referencia 'YYYY')
export function ehAnuidade(p: { referencia: string; periodo_fim?: string | null }): boolean {
  return !!p.periodo_fim || /^\d{4}$/.test(p.referencia);
}

// Cobertura de uma anuidade: novo = referencia..periodo_fim; antigo 'YYYY' = YYYY-01..YYYY-12
export function coberturaAnuidade(p: { referencia: string; periodo_fim?: string | null }): { inicio: string; fim: string } {
  if (/^\d{4}$/.test(p.referencia)) return { inicio: `${p.referencia}-01`, fim: `${p.referencia}-12` };
  return { inicio: p.referencia, fim: p.periodo_fim || p.referencia };
}

// Fim da cobertura em SQL (para MAX nas consultas). Use com alias "cp".
export const SQL_FIM_ANUIDADE = `COALESCE(cp.periodo_fim, CASE WHEN length(cp.referencia) = 4 THEN cp.referencia || '-12' END)`;
export const SQL_EH_ANUIDADE = `(cp.periodo_fim IS NOT NULL OR length(cp.referencia) = 4)`;

function mesAbrev(ym: string): string {
  const [a, m] = ym.split('-');
  const i = parseInt(m, 10) - 1;
  if (!(i >= 0 && i < 12)) return ym;
  return `${MESES_ABREV[i]}/${a}`;
}

// Rótulo legível: "out/2026" | "Anuidade out/2026 a set/2027" | "Anuidade 2026"
export function rotuloPagamento(p: { referencia: string; periodo_fim?: string | null }): string {
  if (/^\d{4}$/.test(p.referencia)) return `Anuidade ${p.referencia}`;
  if (p.periodo_fim) return `Anuidade ${mesAbrev(p.referencia)} a ${mesAbrev(p.periodo_fim)}`;
  return mesAbrev(p.referencia);
}

// Valor padrão da sala+plano na config (cafe_valor_<tipo>_<plano>); null se não configurado
export async function valorPadraoCafe(db: D1Database, tipo: TipoCafe, plano: PlanoCafe): Promise<number | null> {
  const row = await db.prepare('SELECT valor FROM configuracoes WHERE chave = ?')
    .bind(`cafe_valor_${tipo}_${plano}`).first<{ valor: string }>();
  const v = row ? parseFloat(String(row.valor).replace(',', '.')) : NaN;
  return v > 0 ? v : null;
}

// Início da próxima anuidade: mês seguinte ao fim da cobertura, nunca no passado
export function inicioProximaAnuidade(fimCobertura: string | null, mesAtual: string): string {
  if (!fimCobertura) return mesAtual;
  const prox = somarMeses(fimCobertura, 1);
  return prox > mesAtual ? prox : mesAtual;
}

// Fim da cobertura mais recente de um assinante (qualquer status, ou só pagas)
export async function fimCoberturaAnual(db: D1Database, assinanteId: string, somentePagas = false): Promise<string | null> {
  const row = await db.prepare(
    `SELECT MAX(${SQL_FIM_ANUIDADE}) as fim FROM cafe_pagamentos cp
     WHERE cp.assinante_id = ? AND ${SQL_EH_ANUIDADE}${somentePagas ? " AND cp.status = 'pago'" : ''}`
  ).bind(assinanteId).first<{ fim: string | null }>();
  return row?.fim ?? null;
}

type PagamentoRow = { id: string; referencia: string; periodo_fim: string | null; valor: number; status: string; paid_at: string | null };

export function comRotulo<T extends { referencia: string; periodo_fim?: string | null }>(p: T): T & { rotulo: string } {
  return { ...p, periodo_fim: p.periodo_fim ?? null, rotulo: rotuloPagamento(p) };
}

export type StatusCafeMilitar = {
  tem_assinatura: boolean;
  assinante_id: string | null;
  sala: TipoCafe | null;
  tipo: TipoCafe | null;          // legado (= sala)
  sem_sala: boolean;              // praça sem assinatura
  plano: PlanoCafe | null;
  valor: number | null;
  valor_mensal: number | null;    // legado (= valor)
  ativo: boolean;
  mes_atual: string;              // mensal: 'YYYY-MM'; anual: referência da anuidade que cobre o mês (ou o mês atual)
  mes_atual_rotulo: string;
  mes_atual_pago: boolean;
  valido_ate: string | null;      // só anual: fim da cobertura paga mais recente
  total_pendente: number;
  historico: (PagamentoRow & { rotulo: string })[];
};

/**
 * Status do café do militar logado. Acha o assinante pelo cliente vinculado ao trigrama (ativo),
 * sem filtrar pela sala do usuário. Usado por /me/cafe e /me/dashboard.
 */
export async function statusCafeMilitar(db: D1Database, trigrama: string, categoria: string | null): Promise<StatusCafeMilitar> {
  const mesAtual = mesAtualBrasilia();
  const assinante = await db.prepare(
    `SELECT ca.id, ca.tipo, ca.plano, ca.valor
     FROM cafe_assinantes ca JOIN clientes cl ON cl.id = ca.cliente_id
     WHERE cl.nome_guerra = ? COLLATE NOCASE AND ca.ativo = 1
     ORDER BY ca.created_at DESC LIMIT 1`
  ).bind(trigrama).first<{ id: string; tipo: TipoCafe; plano: PlanoCafe; valor: number }>();

  if (!assinante) {
    const sala = tipoCafeDaCategoria(categoria);
    return {
      tem_assinatura: false, assinante_id: null, sala, tipo: sala, sem_sala: sala === null,
      plano: null, valor: null, valor_mensal: null, ativo: false,
      mes_atual: mesAtual, mes_atual_rotulo: rotuloPagamento({ referencia: mesAtual }), mes_atual_pago: false,
      valido_ate: null, total_pendente: 0, historico: [],
    };
  }

  const [pendRow, hist] = await Promise.all([
    db.prepare("SELECT COALESCE(SUM(valor), 0) as total FROM cafe_pagamentos WHERE assinante_id = ? AND status = 'pendente'")
      .bind(assinante.id).first<{ total: number }>(),
    db.prepare('SELECT id, referencia, periodo_fim, valor, status, paid_at FROM cafe_pagamentos WHERE assinante_id = ? ORDER BY referencia DESC LIMIT 12')
      .bind(assinante.id).all<PagamentoRow>(),
  ]);

  let mesRef = mesAtual;
  let mesPago = false;
  let validoAte: string | null = null;

  if (assinante.plano === 'anual') {
    // Todas as anuidades do assinante (o histórico pode estar truncado)
    const { results: anuidades } = await db.prepare(
      `SELECT referencia, periodo_fim, status FROM cafe_pagamentos cp WHERE cp.assinante_id = ? AND ${SQL_EH_ANUIDADE}`
    ).bind(assinante.id).all<{ referencia: string; periodo_fim: string | null; status: string }>();
    for (const a of anuidades) {
      const cob = coberturaAnuidade(a);
      if (a.status === 'pago' && (!validoAte || cob.fim > validoAte)) validoAte = cob.fim;
      if (cob.inicio <= mesAtual && mesAtual <= cob.fim) {
        // Se houver mais de uma cobrindo o mês, prevalece a paga
        if (!mesPago) { mesRef = a.referencia; mesPago = a.status === 'pago'; }
      }
    }
    const atual = anuidades.find(a => a.referencia === mesRef);
    const rotulo = atual ? rotuloPagamento(atual) : rotuloPagamento({ referencia: mesRef });
    return montar(rotulo);
  }

  const pagMes = await db.prepare(
    'SELECT status FROM cafe_pagamentos WHERE assinante_id = ? AND referencia = ? AND periodo_fim IS NULL'
  ).bind(assinante.id, mesAtual).first<{ status: string }>();
  mesPago = pagMes?.status === 'pago';
  return montar(rotuloPagamento({ referencia: mesAtual }));

  function montar(rotuloMes: string): StatusCafeMilitar {
    return {
      tem_assinatura: true,
      assinante_id: assinante!.id,
      sala: assinante!.tipo,
      tipo: assinante!.tipo,
      sem_sala: false,
      plano: assinante!.plano,
      valor: assinante!.valor,
      valor_mensal: assinante!.valor,
      ativo: true,
      mes_atual: mesRef,
      mes_atual_rotulo: rotuloMes,
      mes_atual_pago: mesPago,
      valido_ate: assinante!.plano === 'anual' ? validoAte : null,
      total_pendente: pendRow?.total || 0,
      historico: hist.results.map(comRotulo),
    };
  }
}
