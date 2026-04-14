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
  if (!payload || payload.tipo !== 'usuario') {
    return c.json({ error: 'Token inválido ou expirado' }, 401);
  }

  c.set('userId', payload.id as number);
  c.set('userEmail', payload.email as string);
  c.set('userTrigrama', payload.trigrama as string);
  await next();
}
