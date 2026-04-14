import type { Context } from 'hono';
import type { AppType } from '../index';

/**
 * Valida se o usuario logado pode usar fiado.
 * Se nao esta logado, deixa passar (checkout publico antigo).
 * Se esta logado e o metodo escolhido e fiado, verifica permite_fiado.
 */
export async function podeFazerFiado(c: Context<AppType>, metodo: string): Promise<{ ok: boolean; erro?: string }> {
  if (metodo !== 'fiado') return { ok: true };

  const userId = c.get('userId');
  if (!userId) return { ok: true };

  const u = await c.env.DB.prepare(
    'SELECT permite_fiado, is_visitante FROM usuarios WHERE id = ?'
  ).bind(userId).first<{ permite_fiado: number; is_visitante: number }>();

  if (!u) return { ok: true };

  if (u.permite_fiado === 0) {
    const tipo = u.is_visitante === 1 ? 'Visitantes' : 'Sua conta';
    return {
      ok: false,
      erro: `${tipo} não pode usar fiado. Use PIX para pagar.`,
    };
  }

  return { ok: true };
}
