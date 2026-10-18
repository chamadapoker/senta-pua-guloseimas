import { Hono } from 'hono';
import { authMiddleware, superAdminMiddleware } from '../middleware/auth';
import { hashPassword, verifyPassword } from '../lib/password';
import { checkRateLimit, recordAttempt, clearAttempts } from '../lib/rateLimit';
import { audit } from '../lib/audit';
import { ehEscopoValido } from '../lib/escopo';
import type { AppType } from '../index';

const admins = new Hono<AppType>();

admins.use('*', authMiddleware);

// Qualquer admin vê a lista (sem hash)
admins.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT id, email, nome, role, ativo, escopo, created_at, last_login FROM admins ORDER BY created_at ASC'
  ).all();
  return c.json(results);
});

// Apenas super_admin cria
admins.post('/', superAdminMiddleware, async (c) => {
  const { email, senha, nome, role, escopo } = await c.req.json<{ email: string; senha: string; nome: string; role?: string; escopo?: string | null }>();
  if (!email || !senha || !nome) return c.json({ error: 'Email, senha e nome são obrigatórios' }, 400);
  // escopo: null/ausente = acesso total; senão tem de ser um escopo conhecido
  if (escopo != null && !ehEscopoValido(escopo)) return c.json({ error: 'Escopo inválido' }, 400);
  const finalEscopo = escopo ?? null;
  if (senha.length < 8) return c.json({ error: 'Senha deve ter pelo menos 8 caracteres' }, 400);

  const existing = await c.env.DB.prepare('SELECT id FROM admins WHERE email = ? COLLATE NOCASE').bind(email).first();
  if (existing) return c.json({ error: 'Email já cadastrado' }, 409);

  const createdBy = c.get('adminId');
  const hash = await hashPassword(senha);
  // Admin com escopo nunca é super admin
  const finalRole = role === 'super_admin' && !finalEscopo ? 'super_admin' : 'admin';

  const { results } = await c.env.DB.prepare(
    'INSERT INTO admins (email, senha_hash, nome, role, escopo, created_by) VALUES (?, ?, ?, ?, ?, ?) RETURNING id, email, nome, role, ativo, escopo, created_at'
  ).bind(email.toLowerCase(), hash, nome, finalRole, finalEscopo, createdBy || null).all();

  await audit(c, 'criar_admin', 'admins', (results[0] as { id: string }).id, null, { email, nome, role: finalRole, escopo: finalEscopo });
  return c.json(results[0], 201);
});

// Atualizar (nome, role, ativo, senha, escopo) — super_admin only
admins.put('/:id', superAdminMiddleware, async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{ nome?: string; role?: string; ativo?: boolean; senha?: string; escopo?: string | null }>();

  const alvo = await c.env.DB.prepare('SELECT email, nome, role, ativo, escopo FROM admins WHERE id = ?').bind(id).first<{ email: string; nome: string; role: string; ativo: number; escopo: string | null }>();
  if (!alvo) return c.json({ error: 'Admin não encontrado' }, 404);

  const mexeEscopo = 'escopo' in body;
  if (mexeEscopo && body.escopo != null && !ehEscopoValido(body.escopo)) return c.json({ error: 'Escopo inválido' }, 400);
  const escopoFinal = mexeEscopo ? (body.escopo ?? null) : alvo.escopo;
  // Admin com escopo tem role forçado a 'admin'
  const roleFinal = escopoFinal ? 'admin' : body.role ? (body.role === 'super_admin' ? 'super_admin' : 'admin') : alvo.role;

  const vaiDesativar = body.ativo === false;
  const vaiRebaixar = (!!body.role && body.role !== 'super_admin') || (alvo.role === 'super_admin' && roleFinal !== 'super_admin');

  // Não pode rebaixar/desativar a si mesmo nem se dar escopo (evita auto-lockout)
  if (id === c.get('adminId') && (vaiDesativar || vaiRebaixar || !!escopoFinal)) {
    return c.json({ error: 'Você não pode rebaixar, desativar ou restringir a si mesmo' }, 400);
  }

  // Não pode remover o último super_admin ativo
  if (alvo.role === 'super_admin' && (vaiDesativar || vaiRebaixar)) {
    const sa = await c.env.DB.prepare(
      "SELECT COUNT(*) as n FROM admins WHERE role = 'super_admin' AND ativo = 1"
    ).first<{ n: number }>();
    if ((sa?.n || 0) <= 1) {
      return c.json({ error: 'Não é possível remover o último super admin ativo' }, 400);
    }
  }

  const fields: string[] = [];
  const values: unknown[] = [];

  if (body.nome) { fields.push('nome = ?'); values.push(body.nome); }
  if (body.role || roleFinal !== alvo.role) { fields.push('role = ?'); values.push(roleFinal); }
  if (mexeEscopo) { fields.push('escopo = ?'); values.push(escopoFinal); }
  if (typeof body.ativo === 'boolean') { fields.push('ativo = ?'); values.push(body.ativo ? 1 : 0); }
  if (body.senha) {
    if (body.senha.length < 8) return c.json({ error: 'Senha deve ter pelo menos 8 caracteres' }, 400);
    fields.push('senha_hash = ?');
    values.push(await hashPassword(body.senha));
  }

  if (!fields.length) return c.json({ error: 'Nada para atualizar' }, 400);
  values.push(id);

  const { results } = await c.env.DB.prepare(
    `UPDATE admins SET ${fields.join(', ')} WHERE id = ? RETURNING id, email, nome, role, ativo, escopo`
  ).bind(...values).all();

  if (!results.length) return c.json({ error: 'Admin não encontrado' }, 404);
  // Nunca grava a senha no log, só que ela foi trocada
  await audit(c, 'editar_admin', 'admins', id, alvo, { ...(results[0] as object), senha_alterada: !!body.senha });
  return c.json(results[0]);
});

// Troca de senha do próprio admin logado (não precisa ser super). Exige a senha atual: um token
// roubado/sessão aberta não basta para tomar a conta.
admins.put('/me/senha', async (c) => {
  const id = c.get('adminId');
  if (!id) return c.json({ error: 'Sessão inválida' }, 401);
  const { senha, senha_atual } = await c.req.json<{ senha: string; senha_atual: string }>();
  if (!senha_atual || typeof senha_atual !== 'string') return c.json({ error: 'Informe a senha atual' }, 400);
  if (!senha || typeof senha !== 'string' || senha.length < 8) return c.json({ error: 'Senha deve ter pelo menos 8 caracteres' }, 400);

  // Freia adivinhação da senha atual com um token na mão
  const rlKey = `admin:${id}`;
  const rl = await checkRateLimit(c, 'admin_troca_senha', rlKey, 5, 15);
  if (!rl.ok) return c.json({ error: `Muitas tentativas. Tente de novo em ${rl.retry_after_min} minutos.` }, 429);

  const atual = await c.env.DB.prepare('SELECT senha_hash FROM admins WHERE id = ?').bind(id).first<{ senha_hash: string }>();
  if (!atual || !(await verifyPassword(senha_atual, atual.senha_hash))) {
    await recordAttempt(c, 'admin_troca_senha', rlKey);
    await audit(c, 'trocar_propria_senha_falha', 'admins', id, null, { motivo: 'senha_atual_incorreta' });
    return c.json({ error: 'Senha atual incorreta' }, 403);
  }
  await clearAttempts(c, 'admin_troca_senha', rlKey);

  const hash = await hashPassword(senha);
  await c.env.DB.prepare('UPDATE admins SET senha_hash = ? WHERE id = ?').bind(hash, id).run();
  // Nunca grava a senha (nem o hash) no log
  await audit(c, 'trocar_propria_senha', 'admins', id, null, { senha_alterada: true });
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
