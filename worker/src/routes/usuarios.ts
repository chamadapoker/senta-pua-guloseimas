import { Hono } from 'hono';
import { sign } from '../lib/jwt';
import { hashPassword, verifyPassword } from '../lib/password';
import { userAuthMiddleware } from '../middleware/userAuth';
import { authMiddleware } from '../middleware/auth';
import type { AppType } from '../index';

const usuarios = new Hono<AppType>();

// Publico: cadastro
usuarios.post('/cadastro', async (c) => {
  const { email, senha, trigrama, saram, whatsapp } = await c.req.json<{
    email: string; senha: string; trigrama: string; saram: string; whatsapp: string;
  }>();

  if (!email || !senha || !trigrama || !saram || !whatsapp) {
    return c.json({ error: 'Todos os campos são obrigatórios' }, 400);
  }

  if (senha.length < 6) {
    return c.json({ error: 'Senha deve ter no mínimo 6 caracteres' }, 400);
  }

  const trigramaClean = trigrama.trim().toUpperCase();
  if (!/^[A-ZÀ-ÚÖ]{3}$/.test(trigramaClean)) {
    return c.json({ error: 'Trigrama deve ter exatamente 3 letras' }, 400);
  }

  const saramClean = saram.trim();
  if (!/^\d+$/.test(saramClean)) {
    return c.json({ error: 'SARAM deve conter apenas números' }, 400);
  }

  const emailClean = email.trim().toLowerCase();

  const existEmail = await c.env.DB.prepare('SELECT id FROM usuarios WHERE email = ?').bind(emailClean).first();
  if (existEmail) return c.json({ error: 'Email já cadastrado' }, 409);

  const existTrigrama = await c.env.DB.prepare('SELECT id FROM usuarios WHERE trigrama = ?').bind(trigramaClean).first();
  if (existTrigrama) return c.json({ error: 'Trigrama já cadastrado' }, 409);

  const existSaram = await c.env.DB.prepare('SELECT id FROM usuarios WHERE saram = ?').bind(saramClean).first();
  if (existSaram) return c.json({ error: 'SARAM já cadastrado' }, 409);

  const senhaHash = await hashPassword(senha);
  const whatsappClean = whatsapp.trim();

  const { results } = await c.env.DB.prepare(
    'INSERT INTO usuarios (email, senha_hash, trigrama, saram, whatsapp) VALUES (?, ?, ?, ?, ?) RETURNING id'
  ).bind(emailClean, senhaHash, trigramaClean, saramClean, whatsappClean).all<{ id: number }>();

  const userId = results[0].id;

  // Create or link cliente
  const existCliente = await c.env.DB.prepare(
    'SELECT id FROM clientes WHERE nome_guerra = ? COLLATE NOCASE'
  ).bind(trigramaClean).first();

  if (!existCliente) {
    await c.env.DB.prepare(
      'INSERT INTO clientes (nome_guerra, whatsapp) VALUES (?, ?)'
    ).bind(trigramaClean, whatsappClean).run();
  } else {
    await c.env.DB.prepare('UPDATE clientes SET whatsapp = ? WHERE nome_guerra = ? COLLATE NOCASE')
      .bind(whatsappClean, trigramaClean).run();
  }

  const token = await sign(
    { tipo: 'usuario', id: userId, email: emailClean, trigrama: trigramaClean },
    c.env.JWT_SECRET,
    720 // 30 dias
  );

  return c.json({
    token,
    user: { id: userId, email: emailClean, trigrama: trigramaClean, saram: saramClean, whatsapp: whatsappClean, foto_url: null }
  }, 201);
});

// Publico: login
usuarios.post('/login', async (c) => {
  const { email, senha } = await c.req.json<{ email: string; senha: string }>();

  if (!email || !senha) {
    return c.json({ error: 'Email e senha obrigatórios' }, 400);
  }

  const user = await c.env.DB.prepare(
    'SELECT id, email, senha_hash, trigrama, saram, whatsapp, foto_url, ativo FROM usuarios WHERE email = ?'
  ).bind(email.trim().toLowerCase()).first<{
    id: number; email: string; senha_hash: string; trigrama: string; saram: string; whatsapp: string; foto_url: string | null; ativo: number;
  }>();

  if (!user) return c.json({ error: 'Email ou senha incorretos' }, 401);
  if (!user.ativo) return c.json({ error: 'Conta desativada. Procure o administrador.' }, 403);

  const valid = await verifyPassword(senha, user.senha_hash);
  if (!valid) return c.json({ error: 'Email ou senha incorretos' }, 401);

  const token = await sign(
    { tipo: 'usuario', id: user.id, email: user.email, trigrama: user.trigrama },
    c.env.JWT_SECRET,
    720
  );

  return c.json({
    token,
    user: { id: user.id, email: user.email, trigrama: user.trigrama, saram: user.saram, whatsapp: user.whatsapp, foto_url: user.foto_url }
  });
});

// Usuario logado: dados do perfil
usuarios.get('/me', userAuthMiddleware, async (c) => {
  const userId = c.get('userId');
  const user = await c.env.DB.prepare(
    'SELECT id, email, trigrama, saram, whatsapp, foto_url, created_at FROM usuarios WHERE id = ?'
  ).bind(userId).first();

  if (!user) return c.json({ error: 'Usuário não encontrado' }, 404);
  return c.json(user);
});

// Usuario logado: atualizar perfil
usuarios.put('/me', userAuthMiddleware, async (c) => {
  const userId = c.get('userId');
  const { whatsapp, saram } = await c.req.json<{ whatsapp?: string; saram?: string }>();

  const updates: string[] = [];
  const params: unknown[] = [];

  if (whatsapp) {
    updates.push('whatsapp = ?');
    params.push(whatsapp.trim());
  }
  if (saram) {
    const saramClean = saram.trim();
    if (!/^\d+$/.test(saramClean)) return c.json({ error: 'SARAM deve conter apenas números' }, 400);
    const existSaram = await c.env.DB.prepare('SELECT id FROM usuarios WHERE saram = ? AND id != ?')
      .bind(saramClean, userId).first();
    if (existSaram) return c.json({ error: 'SARAM já cadastrado por outro usuário' }, 409);
    updates.push('saram = ?');
    params.push(saramClean);
  }

  if (!updates.length) return c.json({ error: 'Nenhum campo para atualizar' }, 400);

  params.push(userId);
  await c.env.DB.prepare(`UPDATE usuarios SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();

  // Also update whatsapp in clientes
  if (whatsapp) {
    const trigrama = c.get('userTrigrama');
    await c.env.DB.prepare('UPDATE clientes SET whatsapp = ? WHERE nome_guerra = ? COLLATE NOCASE')
      .bind(whatsapp.trim(), trigrama).run();
  }

  const user = await c.env.DB.prepare(
    'SELECT id, email, trigrama, saram, whatsapp, foto_url, created_at FROM usuarios WHERE id = ?'
  ).bind(userId).first();
  return c.json(user);
});

// Usuario logado: upload foto
usuarios.post('/me/foto', userAuthMiddleware, async (c) => {
  const userId = c.get('userId');
  const formData = await c.req.formData();
  const file = formData.get('foto') as File | null;

  if (!file) return c.json({ error: 'Nenhum arquivo enviado' }, 400);
  if (file.size > 2 * 1024 * 1024) return c.json({ error: 'Arquivo muito grande. Máximo 2MB' }, 400);

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
    return c.json({ error: 'Formato não suportado. Use: jpg, png, webp' }, 400);
  }

  // Delete old photo
  const current = await c.env.DB.prepare('SELECT foto_url FROM usuarios WHERE id = ?').bind(userId)
    .first<{ foto_url: string | null }>();
  if (current?.foto_url) {
    const oldKey = current.foto_url.replace('/api/images/', '');
    await c.env.IMAGES.delete(oldKey).catch(() => {});
  }

  const key = `usuarios/${userId}/foto.${ext}`;
  await c.env.IMAGES.put(key, file.stream(), { httpMetadata: { contentType: file.type } });

  const fotoUrl = `/api/images/${key}`;
  await c.env.DB.prepare('UPDATE usuarios SET foto_url = ? WHERE id = ?').bind(fotoUrl, userId).run();

  return c.json({ foto_url: fotoUrl });
});

// Usuario logado: remover foto
usuarios.delete('/me/foto', userAuthMiddleware, async (c) => {
  const userId = c.get('userId');
  const current = await c.env.DB.prepare('SELECT foto_url FROM usuarios WHERE id = ?').bind(userId)
    .first<{ foto_url: string | null }>();

  if (current?.foto_url) {
    const key = current.foto_url.replace('/api/images/', '');
    await c.env.IMAGES.delete(key).catch(() => {});
  }

  await c.env.DB.prepare('UPDATE usuarios SET foto_url = NULL WHERE id = ?').bind(userId).run();
  return c.json({ ok: true });
});

// Admin: listar usuarios
usuarios.get('/admin/lista', authMiddleware, async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT id, email, trigrama, saram, whatsapp, foto_url, ativo, created_at FROM usuarios ORDER BY trigrama'
  ).all();
  return c.json(results);
});

// Admin: resetar senha
usuarios.put('/admin/:id/senha', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const { nova_senha } = await c.req.json<{ nova_senha: string }>();

  if (!nova_senha || nova_senha.length < 6) {
    return c.json({ error: 'Senha deve ter no mínimo 6 caracteres' }, 400);
  }

  const senhaHash = await hashPassword(nova_senha);
  const result = await c.env.DB.prepare('UPDATE usuarios SET senha_hash = ? WHERE id = ?')
    .bind(senhaHash, id).run();

  if (!result.meta.changes) return c.json({ error: 'Usuário não encontrado' }, 404);
  return c.json({ ok: true });
});

// Admin: desativar usuario
usuarios.put('/admin/:id/desativar', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const result = await c.env.DB.prepare('UPDATE usuarios SET ativo = 0 WHERE id = ?').bind(id).run();
  if (!result.meta.changes) return c.json({ error: 'Usuário não encontrado' }, 404);
  return c.json({ ok: true });
});

// Admin: ativar usuario
usuarios.put('/admin/:id/ativar', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const result = await c.env.DB.prepare('UPDATE usuarios SET ativo = 1 WHERE id = ?').bind(id).run();
  if (!result.meta.changes) return c.json({ error: 'Usuário não encontrado' }, 404);
  return c.json({ ok: true });
});

export default usuarios;
