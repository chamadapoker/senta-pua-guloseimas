import type { Context } from 'hono';
import type { AppType } from '../index';

/**
 * Valida se quem está comprando pode usar fiado.
 * Fiado exige login: sem usuário logado é recusado (evita dívida anônima em nome de outro).
 * Logado: usuário precisa existir, estar ativo e ter permite_fiado.
 */
export async function podeFazerFiado(c: Context<AppType>, metodo: string): Promise<{ ok: boolean; erro?: string }> {
  if (metodo !== 'fiado') return { ok: true };

  const userId = c.get('userId');
  if (!userId) return { ok: false, erro: 'Faça login para comprar fiado' };

  const u = await c.env.DB.prepare(
    'SELECT permite_fiado, is_visitante, ativo FROM usuarios WHERE id = ?'
  ).bind(userId).first<{ permite_fiado: number; is_visitante: number; ativo: number }>();

  if (!u || u.ativo === 0) return { ok: false, erro: 'Conta inválida ou desativada.' };

  if (u.permite_fiado === 0) {
    const tipo = u.is_visitante === 1 ? 'Visitantes' : 'Sua conta';
    return {
      ok: false,
      erro: `${tipo} não pode usar fiado. Use PIX para pagar.`,
    };
  }

  return { ok: true };
}
