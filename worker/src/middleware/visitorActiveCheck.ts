import { Context, Next } from 'hono';
import { visitanteBloqueado } from '../lib/visitante';
import type { AppType } from '../index';

export async function visitorActiveCheck(c: Context<AppType>, next: Next) {
  const userId = c.get('userId');
  if (!userId) return next();

  const u = await c.env.DB.prepare(
    'SELECT is_visitante, expira_em, acesso_pausado FROM usuarios WHERE id = ?'
  ).bind(userId).first<{ is_visitante: number; expira_em: string | null; acesso_pausado: number }>();

  if (u && visitanteBloqueado(u)) {
    return c.json({ error: 'Acesso de visitante expirado ou pausado', acesso_bloqueado: true }, 403);
  }

  await next();
}
