import { Context, Next } from 'hono';
import { verify } from '../lib/jwt';
import type { AppType } from '../index';

export async function userAuthMiddleware(c: Context<AppType>, next: Next) {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) {
    return c.json({ error: 'Token não fornecido' }, 401);
  }

  const token = header.slice(7);
  const payload = await verify(token, c.env.JWT_SECRET);
  if (!payload || payload.tipo !== 'usuario' || payload.id == null) {
    return c.json({ error: 'Token inválido ou expirado' }, 401);
  }

  // Confere no banco a cada requisição (como o authMiddleware de admin): conta desativada perde o
  // acesso na hora, e o trigrama/email usados nas consultas são os ATUAIS, nunca os gravados no
  // token (o admin pode renomear o militar e outra pessoa assumir o trigrama antigo).
  // Visitante pausado/expirado segue tratado pelo visitorActiveCheck.
  const user = await c.env.DB.prepare(
    'SELECT id, email, trigrama FROM usuarios WHERE id = ? AND ativo = 1'
  ).bind(payload.id as number).first<{ id: number; email: string; trigrama: string }>();
  if (!user) {
    return c.json({ error: 'Token inválido ou expirado' }, 401);
  }

  c.set('userId', user.id);
  c.set('userEmail', user.email);
  c.set('userTrigrama', user.trigrama);
  await next();
}
