import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import type { AppType } from '../index';
import type { Produto } from '../db/queries';

const produtos = new Hono<AppType>();

// Público: lista produtos disponíveis
produtos.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM produtos WHERE disponivel = 1 ORDER BY ordem ASC'
  ).all<Produto>();
  return c.json(results);
});

// Admin: lista todos os produtos
produtos.get('/todos', authMiddleware, async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM produtos ORDER BY ordem ASC'
  ).all<Produto>();
  return c.json(results);
});

// Admin: criar produto
produtos.post('/', authMiddleware, async (c) => {
  const { nome, emoji, preco, disponivel, ordem, imagem_url } = await c.req.json();

  if (!nome || preco == null) {
    return c.json({ error: 'Nome e preço obrigatórios' }, 400);
  }

  const { results } = await c.env.DB.prepare(
    'INSERT INTO produtos (nome, emoji, preco, disponivel, ordem, imagem_url) VALUES (?, ?, ?, ?, ?, ?) RETURNING *'
  ).bind(nome, emoji || '🍬', preco, disponivel ?? 1, ordem ?? 0, imagem_url || null).all<Produto>();

  return c.json(results[0], 201);
});

// Admin: editar produto
produtos.put('/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();

  // Build dynamic SET clause so we only update fields that were sent
  const fields: string[] = [];
  const values: unknown[] = [];

  if ('nome' in body) { fields.push('nome = ?'); values.push(body.nome); }
  if ('emoji' in body) { fields.push('emoji = ?'); values.push(body.emoji); }
  if ('preco' in body) { fields.push('preco = ?'); values.push(body.preco); }
  if ('disponivel' in body) { fields.push('disponivel = ?'); values.push(body.disponivel); }
  if ('ordem' in body) { fields.push('ordem = ?'); values.push(body.ordem); }
  if ('imagem_url' in body) { fields.push('imagem_url = ?'); values.push(body.imagem_url); }

  if (!fields.length) return c.json({ error: 'Nenhum campo para atualizar' }, 400);

  values.push(id);
  const { results } = await c.env.DB.prepare(
    `UPDATE produtos SET ${fields.join(', ')} WHERE id = ? RETURNING *`
  ).bind(...values).all<Produto>();

  if (!results.length) return c.json({ error: 'Produto não encontrado' }, 404);
  return c.json(results[0]);
});

// Admin: remover produto
produtos.delete('/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const result = await c.env.DB.prepare('DELETE FROM produtos WHERE id = ?').bind(id).run();

  if (!result.meta.changes) return c.json({ error: 'Produto não encontrado' }, 404);
  return c.json({ ok: true });
});

export default produtos;
