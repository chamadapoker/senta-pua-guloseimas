import type { Context } from 'hono';
import type { AppType } from '../index';
import type { TipoCafe } from './cafe';
import { auditarNegacaoEscopo } from './audit';

// Admin com escopo: acesso restrito a uma parte do sistema (validado no servidor em toda requisição)

export type EscopoAdmin = 'cafe_graduado';
export const ESCOPOS_ADMIN: EscopoAdmin[] = ['cafe_graduado'];

export const MSG_ESCOPO_NEGADO = 'Seu acesso é só ao café dos graduados';

// Lista de permissão por escopo: [método, regex do caminho completo]. Fora dela => 403.
const PERMISSOES: Record<EscopoAdmin, [string, RegExp][]> = {
  cafe_graduado: [
    ['GET', /^\/api\/auth\/me$/],
    ['PUT', /^\/api\/admins\/me\/senha$/],
    ['*', /^\/api\/cafe\/admin\/.+$/],
    ['GET', /^\/api\/comprovantes$/],
    ['GET', /^\/api\/comprovantes\/pendentes\/count$/],
    ['PUT', /^\/api\/comprovantes\/[^/]+\/aprovar$/],
    ['PUT', /^\/api\/comprovantes\/[^/]+\/rejeitar$/],
    // Arquivo do comprovante: a rota ainda confere se o comprovante é do café da sala do escopo
    ['GET', /^\/api\/comprovantes\/[^/]+\/imagem$/],
    ['PUT', /^\/api\/config$/],
    ['GET', /^\/api\/usuarios\/admin\/por-trigrama\/[^/]+$/],
  ],
};

export function ehEscopoValido(v: unknown): v is EscopoAdmin {
  return typeof v === 'string' && (ESCOPOS_ADMIN as string[]).includes(v);
}

// Escopo desconhecido (valor estranho no banco) não libera nada
export function rotaPermitidaNoEscopo(escopo: string, metodo: string, caminho: string): boolean {
  const regras = ehEscopoValido(escopo) ? PERMISSOES[escopo] : [];
  return regras.some(([m, re]) => (m === '*' || m === metodo) && re.test(caminho));
}

// Sala do café a que o admin está preso (null = sem restrição)
export function salaDoEscopo(c: Context<AppType>): TipoCafe | null {
  return c.get('adminEscopo') === 'cafe_graduado' ? 'graduado' : null;
}

// Sala efetiva para rotas com ?tipo= / tipo no body.
// Com escopo: ausente => sala do escopo; diferente => negado. Sem escopo: devolve o que veio.
export function garantirSalaPermitida(
  c: Context<AppType>, tipo: string | null | undefined
): { ok: true; tipo: string | undefined } | { ok: false; resposta: Response } {
  const sala = salaDoEscopo(c);
  if (!sala) return { ok: true, tipo: tipo || undefined };
  if (tipo && tipo !== sala) {
    // Função síncrona: o registro de auditoria roda em segundo plano (com dedupe de 10 min)
    try { c.executionCtx.waitUntil(auditarNegacaoEscopo(c)); } catch { /* sem executionCtx: não audita */ }
    return { ok: false, resposta: c.json({ error: MSG_ESCOPO_NEGADO, escopo_negado: true }, 403) };
  }
  return { ok: true, tipo: sala };
}

// SQL que devolve a sala de cada recurso do café pelo id
const SQL_SALA: Record<'assinante' | 'pagamento' | 'insumo' | 'despesa', string> = {
  assinante: 'SELECT tipo FROM cafe_assinantes WHERE id = ?',
  pagamento: 'SELECT ca.tipo FROM cafe_pagamentos cp JOIN cafe_assinantes ca ON ca.id = cp.assinante_id WHERE cp.id = ?',
  insumo: 'SELECT tipo FROM cafe_insumos WHERE id = ?',
  despesa: 'SELECT tipo FROM cafe_despesas WHERE id = ?',
};

// Recurso por id pertence à sala do escopo? Sem escopo sempre true.
// Quem chama responde 404 quando false (não revela que o recurso existe).
export async function recursoNaSala(
  c: Context<AppType>, recurso: keyof typeof SQL_SALA, id: string | undefined
): Promise<boolean> {
  const sala = salaDoEscopo(c);
  if (!sala) return true;
  if (!id) return false;
  const row = await c.env.DB.prepare(SQL_SALA[recurso]).bind(id).first<{ tipo: string }>();
  return row?.tipo === sala;
}

// Filtro SQL de comprovantes visíveis ao escopo (só café de pagamento da sala). Sem escopo => null.
export function filtroComprovantesEscopo(c: Context<AppType>): { sql: string; params: unknown[] } | null {
  const sala = salaDoEscopo(c);
  if (!sala) return null;
  return {
    sql: `origem = 'cafe' AND referencia_id IN (
      SELECT cp.id FROM cafe_pagamentos cp JOIN cafe_assinantes ca ON ca.id = cp.assinante_id WHERE ca.tipo = ?)`,
    params: [sala],
  };
}

// Chaves de configuração que cada escopo pode alterar
export const CHAVES_CONFIG_ESCOPO: Record<EscopoAdmin, string[]> = {
  cafe_graduado: [
    'pix_cafe_graduado_chave', 'pix_cafe_graduado_nome', 'pix_cafe_graduado_whatsapp',
    'cafe_valor_graduado_mensal', 'cafe_valor_graduado_anual', 'nome_cafe_graduados',
  ],
};
