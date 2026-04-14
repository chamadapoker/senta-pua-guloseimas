import { Hono } from 'hono';
import { authMiddleware, superAdminMiddleware } from '../middleware/auth';
import { hashPassword } from '../lib/password';
import { audit } from '../lib/audit';
import type { AppType } from '../index';

const admins = new Hono<AppType>();

admins.use('*', authMiddleware);

// Qualquer admin vê a lista (sem hash)
admins.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT id, email, nome, role, ativo, created_at, last_login FROM admins ORDER BY created_at ASC'
  ).all();
  return c.json(results);
});

// Apenas super_admin cria
admins.post('/', superAdminMiddleware, async (c) => {
  const { email, senha, nome, role } = await c.req.json<{ email: string; senha: string; nome: string; role?: string }>();
  if (!email || !senha || !nome) return c.json({ error: 'Email, senha e nome são obrigatórios' }, 400);
  if (senha.length < 8) return c.json({ error: 'Senha deve ter pelo menos 8 caracteres' }, 400);

  const existing = await c.env.DB.prepare('SELECT id FROM admins WHERE email = ? COLLATE NOCASE').bind(email).first();
  if (existing) return c.json({ error: 'Email já cadastrado' }, 409);

  const createdBy = c.get('adminId');
  const hash = await hashPassword(senha);
  const finalRole = role === 'super_admin' ? 'super_admin' : 'admin';

  const { results } = await c.env.DB.prepare(
    'INSERT INTO admins (email, senha_hash, nome, role, created_by) VALUES (?, ?, ?, ?, ?) RETURNING id, email, nome, role, ativo, created_at'
  ).bind(email.toLowerCase(), hash, nome, finalRole, createdBy || null).all();

  await audit(c, 'criar_admin', 'admins', (results[0] as { id: string }).id, null, { email, nome, role: finalRole });
  return c.json(results[0], 201);
});

// Atualizar (nome, role, ativo, senha) — super_admin only
admins.put('/:id', superAdminMiddleware, async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{ nome?: string; role?: string; ativo?: boolean; senha?: string }>();

  const fields: string[] = [];
  const values: unknown[] = [];

  if (body.nome) { fields.push('nome = ?'); values.push(body.nome); }
  if (body.role) { fields.push('role = ?'); values.push(body.role === 'super_admin' ? 'super_admin' : 'admin'); }
  if (typeof body.ativo === 'boolean') { fields.push('ativo = ?'); values.push(body.ativo ? 1 : 0); }
  if (body.senha) {
    if (body.senha.length < 8) return c.json({ error: 'Senha deve ter pelo menos 8 caracteres' }, 400);
    fields.push('senha_hash = ?');
    values.push(await hashPassword(body.senha));
  }

  if (!fields.length) return c.json({ error: 'Nada para atualizar' }, 400);
  values.push(id);

  const { results } = await c.env.DB.prepare(
    `UPDATE admins SET ${fields.join(', ')} WHERE id = ? RETURNING id, email, nome, role, ativo`
  ).bind(...values).all();

  if (!results.length) return c.json({ error: 'Admin não encontrado' }, 404);
  return c.json(results[0]);
});

// Troca de senha do próprio admin logado (não precisa ser super)
admins.put('/me/senha', async (c) => {
  const id = c.get('adminId');
  if (!id) return c.json({ error: 'Sessão inválida' }, 401);
  const { senha } = await c.req.json<{ senha: string }>();
  if (!senha || senha.length < 8) return c.json({ error: 'Senha deve ter pelo menos 8 caracteres' }, 400);

  const hash = await hashPassword(senha);
  await c.env.DB.prepare('UPDATE admins SET senha_hash = ? WHERE id = ?').bind(hash, id).run();
  return c.json({ ok: true });
});

// Remover admin — super_admin only, não pode remover a si mesmo
admins.delete('/:id', superAdminMiddleware, async (c) => {
  const id = c.req.param('id');
  const selfId = c.get('adminId');
  if (id === selfId) return c.json({ error: 'Não é possível remover a si mesmo' }, 400);

  const antes = await c.env.DB.prepare('SELECT email, nome, role FROM admins WHERE id = ?').bind(id).first();
  const result = await c.env.DB.prepare('DELETE FROM admins WHERE id = ?').bind(id).run();
  if (!result.meta.changes) return c.json({ error: 'Admin não encontrado' }, 404);
  await audit(c, 'excluir_admin', 'admins', id, antes, null);
  return c.json({ ok: true });
});

export default admins;
