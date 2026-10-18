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
  // Tokens de usuário (tipo 'usuario') usam o mesmo segredo: nunca valem como admin
  if (!payload || payload.tipo === 'usuario' || !payload.id) {
    return c.json({ error: 'Token inválido ou expirado' }, 401);
  }

  // Confere no banco a cada requisição: admin desativado ou rebaixado perde o acesso na hora
  const admin = await c.env.DB.prepare(
    'SELECT id, email, role FROM admins WHERE id = ? AND ativo = 1'
  ).bind(payload.id as string).first<{ id: string; email: string; role: string }>();
  if (!admin) {
    return c.json({ error: 'Token inválido ou expirado' }, 401);
  }

  c.set('adminEmail', admin.email);
  c.set('adminRole', admin.role);
  c.set('adminId', admin.id);
  await next();
}

export async function superAdminMiddleware(c: Context<AppType>, next: Next) {
  const role = c.get('adminRole');
  if (role !== 'super_admin') return c.json({ error: 'Apenas super admin pode executar esta ação' }, 403);
  await next();
}
