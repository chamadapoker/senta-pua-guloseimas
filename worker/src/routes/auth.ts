import { Hono } from 'hono';
import { sign } from '../lib/jwt';
import { hashPassword, verifyPassword, gastarTempoDeVerificacao } from '../lib/password';
import { audit } from '../lib/audit';
import { checkRateLimit, recordAttempt, clearAttempts, clientKey } from '../lib/rateLimit';
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
  if (!email || !senha || typeof email !== 'string' || typeof senha !== 'string') {
    return c.json({ error: 'Email e senha obrigatórios' }, 400);
  }
  const emailLog = email.trim().toLowerCase().slice(0, 254);

  const ip = clientKey(c);
  const key = `${ip}:${email.toLowerCase()}`;
  const rl = await checkRateLimit(c, 'admin_login', key, 5, 15);
  if (!rl.ok) return c.json({ error: `Muitas tentativas. Tente de novo em ${rl.retry_after_min} minutos.` }, 429);

  await ensureSuperAdmin(c.env);

  const admin = await c.env.DB.prepare(
    'SELECT id, email, senha_hash, nome, role, ativo, escopo FROM admins WHERE email = ? COLLATE NOCASE'
  ).bind(email).first<{ id: string; email: string; senha_hash: string; nome: string; role: string; ativo: number; escopo: string | null }>();

  // Sempre roda um PBKDF2 (contra um hash de mentira quando o admin não existe): o tempo de resposta
  // não revela quais e-mails existem. Admin inexistente, inativo ou senha errada => mesma resposta.
  const ok = admin ? await verifyPassword(senha, admin.senha_hash) : (await gastarTempoDeVerificacao(senha), false);
  if (!admin || !admin.ativo || !ok) {
    await recordAttempt(c, 'admin_login', key);
    // Auditoria: só o e-mail informado e o IP (coluna ip_address); nunca a senha
    await audit(c, 'login_admin_falha', 'admins', admin?.id ?? null, null, { email: emailLog }, emailLog);
    return c.json({ error: 'Credenciais inválidas' }, 401);
  }

  await clearAttempts(c, 'admin_login', key);
  await c.env.DB.prepare("UPDATE admins SET last_login = datetime('now') WHERE id = ?").bind(admin.id).run();
  await audit(c, 'login_admin_ok', 'admins', admin.id, null, { email: admin.email }, admin.email);

  const token = await sign({ tipo: 'admin', id: admin.id, email: admin.email, role: admin.role }, c.env.JWT_SECRET);
  return c.json({ token, admin: { id: admin.id, email: admin.email, nome: admin.nome, role: admin.role, escopo: admin.escopo ?? null } });
});

auth.get('/me', authMiddleware, async (c) => {
  const email = c.get('adminEmail');
  const admin = await c.env.DB.prepare(
    'SELECT id, email, nome, role, escopo FROM admins WHERE id = ?'
  ).bind(c.get('adminId')).first();
  return c.json(admin || { email, escopo: c.get('adminEscopo') });
});

export default auth;
