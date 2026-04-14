import { Hono } from 'hono';
import { sign } from '../lib/jwt';
import { hashPassword, verifyPassword } from '../lib/password';
import { authMiddleware } from '../middleware/auth';
import type { AppType } from '../index';

const auth = new Hono<AppType>();

// Bootstrap: cria o admin do .env se ainda não existir no DB
async function ensureSuperAdmin(env: AppType['Bindings']) {
  if (!env.ADMIN_EMAIL || !env.ADMIN_SENHA) return;
  const existing = await env.DB.prepare('SELECT id FROM admins WHERE email = ?').bind(env.ADMIN_EMAIL).first();
  if (existing) return;
  const hash = await hashPassword(env.ADMIN_SENHA);
  await env.DB.prepare(
    "INSERT INTO admins (email, senha_hash, nome, role) VALUES (?, ?, ?, 'super_admin')"
  ).bind(env.ADMIN_EMAIL, hash, 'Super Admin').run();
}

auth.post('/login', async (c) => {
  const { email, senha } = await c.req.json<{ email: string; senha: string }>();
  if (!email || !senha) return c.json({ error: 'Email e senha obrigatórios' }, 400);

  await ensureSuperAdmin(c.env);

  const admin = await c.env.DB.prepare(
    'SELECT id, email, senha_hash, nome, role, ativo FROM admins WHERE email = ? COLLATE NOCASE'
  ).bind(email).first<{ id: string; email: string; senha_hash: string; nome: string; role: string; ativo: number }>();

  if (!admin || !admin.ativo) return c.json({ error: 'Credenciais inválidas' }, 401);
  const ok = await verifyPassword(senha, admin.senha_hash);
  if (!ok) return c.json({ error: 'Credenciais inválidas' }, 401);

  await c.env.DB.prepare("UPDATE admins SET last_login = datetime('now') WHERE id = ?").bind(admin.id).run();

  const token = await sign({ id: admin.id, email: admin.email, role: admin.role }, c.env.JWT_SECRET);
  return c.json({ token, admin: { id: admin.id, email: admin.email, nome: admin.nome, role: admin.role } });
});

auth.get('/me', authMiddleware, async (c) => {
  const email = c.get('adminEmail');
  const admin = await c.env.DB.prepare(
    'SELECT id, email, nome, role FROM admins WHERE email = ?'
  ).bind(email).first();
  return c.json(admin || { email });
});

export default auth;
