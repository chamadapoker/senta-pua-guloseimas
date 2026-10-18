import type { Context } from 'hono';
import type { AppType } from '../index';

type DadosPedido = {
  nome_guerra?: string;
  whatsapp?: string;
  visitante?: boolean;
  esquadrao_origem?: string;
};

type Resultado =
  | { ok: true; cliente: { id: string; ativo: number } }
  | { ok: false; status: 400 | 403; erro: string };

/**
 * Resolve (busca ou cria) o cliente dono de um pedido.
 * - Usuário logado: o dono é SEMPRE o trigrama do usuário (o nome_guerra do body é ignorado)
 *   e os dados do cliente vêm do cadastro do usuário, nunca do body.
 * - Sem login: usa o nome_guerra do body, mas nunca altera um cliente que já existe.
 */
export async function resolverClienteDoPedido(
  c: Context<AppType>,
  dados: DadosPedido,
  msgBloqueado: string
): Promise<Resultado> {
  const userId = c.get('userId');
  let nome: string;
  let novo: { whatsapp: string | null; visitante: number; esquadrao_origem: string | null };

  if (userId) {
    // Trigrama lido do banco (o do token pode estar desatualizado se o admin editou)
    const u = await c.env.DB.prepare(
      'SELECT trigrama, whatsapp, is_visitante, esquadrao_origem, ativo FROM usuarios WHERE id = ?'
    ).bind(userId).first<{ trigrama: string; whatsapp: string | null; is_visitante: number; esquadrao_origem: string | null; ativo: number }>();
    if (!u || u.ativo === 0) return { ok: false, status: 403, erro: 'Conta desativada. Procure o administrador.' };
    nome = u.trigrama;
    novo = { whatsapp: u.whatsapp || null, visitante: u.is_visitante === 1 ? 1 : 0, esquadrao_origem: u.esquadrao_origem || null };
  } else {
    nome = (dados.nome_guerra || '').trim().toUpperCase();
    if (!nome) return { ok: false, status: 400, erro: 'nome_guerra é obrigatório' };
    novo = {
      whatsapp: dados.whatsapp?.trim() || null,
      visitante: dados.visitante ? 1 : 0,
      esquadrao_origem: dados.esquadrao_origem?.trim().toUpperCase() || null,
    };
  }

  const cliente = await c.env.DB.prepare(
    'SELECT id, ativo FROM clientes WHERE nome_guerra = ? COLLATE NOCASE'
  ).bind(nome).first<{ id: string; ativo: number }>();

  if (cliente && !cliente.ativo) return { ok: false, status: 403, erro: msgBloqueado };
  if (cliente) return { ok: true, cliente };

  const { results } = await c.env.DB.prepare(
    'INSERT INTO clientes (nome_guerra, whatsapp, visitante, esquadrao_origem) VALUES (?, ?, ?, ?) RETURNING id'
  ).bind(nome, novo.whatsapp, novo.visitante, novo.esquadrao_origem).all<{ id: string }>();
  return { ok: true, cliente: { id: results[0].id, ativo: 1 } };
}
