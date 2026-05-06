import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { userAuthMiddleware } from '../middleware/userAuth';
import type { AppType } from '../index';

const notificacoes = new Hono<AppType>();

// -- USER: Listar minhas notificações --
notificacoes.get('/me', userAuthMiddleware, async (c) => {
  const trigrama = c.get('userTrigrama');
  
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM notificacoes WHERE trigrama = ? COLLATE NOCASE ORDER BY created_at DESC LIMIT 20'
  ).bind(trigrama).all();

  return c.json(results);
});

// -- USER: Marcar como lida --
notificacoes.put('/:id/lida', userAuthMiddleware, async (c) => {
  const id = c.req.param('id');
  const trigrama = c.get('userTrigrama');

  await c.env.DB.prepare(
    'UPDATE notificacoes SET lida = 1 WHERE id = ? AND trigrama = ? COLLATE NOCASE'
  ).bind(id, trigrama).run();

  return c.json({ ok: true });
});

// -- ADMIN: Enviar notificação --
notificacoes.post('/admin/enviar', authMiddleware, async (c) => {
  const { trigrama, titulo, mensagem } = await c.req.json<{ trigrama: string; titulo: string; mensagem: string }>();

  if (!trigrama || !titulo || !mensagem) {
    return c.json({ error: 'Campos obrigatórios: trigrama, titulo, mensagem' }, 400);
  }

  // Auto-cria a tabela se não existir (safe guard)
  await c.env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS notificacoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trigrama TEXT,
      titulo TEXT,
      mensagem TEXT,
      lida INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  const { results } = await c.env.DB.prepare(
    'INSERT INTO notificacoes (trigrama, titulo, mensagem) VALUES (?, ?, ?) RETURNING *'
  ).bind(trigrama.toUpperCase(), titulo, mensagem).all();

  return c.json(results[0], 201);
});

export default notificacoes;
