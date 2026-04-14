import { Context, Next } from 'hono';
import { verify } from '../lib/jwt';
import type { AppType } from '../index';

export async function authMiddleware(c: Context<AppType>, next: Next) {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) {
    return c.json({ error: 'Token não fornecido' }, 401);
  }

  const token = header.slice(7);
  const payload = await verify(token, c.env.JWT_SECRET);
  if (!payload) {
    return c.json({ error: 'Token inválido ou expirado' }, 401);
  }

  c.set('adminEmail', payload.email as string);
  if (payload.role) c.set('adminRole', payload.role as string);
  if (payload.id) c.set('adminId', payload.id as string);
  await next();
}

export async function superAdminMiddleware(c: Context<AppType>, next: Next) {
  const role = c.get('adminRole');
  if (role !== 'super_admin') return c.json({ error: 'Apenas super admin pode executar esta ação' }, 403);
  await next();
}
