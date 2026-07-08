import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import type { AppType } from '../index';

const inventario = new Hono<AppType>();

// Tudo aqui e admin.
inventario.use('*', authMiddleware);

// ============ FORNECEDORES ============
inventario.get('/fornecedores', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM fornecedores ORDER BY nome ASC'
  ).all();
  return c.json(results);
});

inventario.post('/fornecedores', async (c) => {
  const { nome, contato, endereco, observacao } = await c.req.json();
  if (!nome) return c.json({ error: 'Nome obrigatório' }, 400);
  const { results } = await c.env.DB.prepare(
    'INSERT INTO fornecedores (nome, contato, endereco, observacao) VALUES (?, ?, ?, ?) RETURNING *'
  ).bind(nome.trim(), contato?.trim() || null, endereco?.trim() || null, observacao?.trim() || null).all();
  return c.json(results[0], 201);
});

inventario.put('/fornecedores/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const k of ['nome', 'contato', 'endereco', 'observacao']) {
    if (k in body) { fields.push(`${k} = ?`); values.push(body[k] || null); }
  }
  if (!fields.length) return c.json({ error: 'Nada para atualizar' }, 400);
  values.push(id);
  const { results } = await c.env.DB.prepare(
    `UPDATE fornecedores SET ${fields.join(', ')} WHERE id = ? RETURNING *`
  ).bind(...values).all();
  if (!results.length) return c.json({ error: 'Fornecedor não encontrado' }, 404);
  return c.json(results[0]);
});

inventario.delete('/fornecedores/:id', async (c) => {
  const result = await c.env.DB.prepare('DELETE FROM fornecedores WHERE id = ?').bind(c.req.param('id')).run();
  if (!result.meta.changes) return c.json({ error: 'Fornecedor não encontrado' }, 404);
  return c.json({ ok: true });
});

// ============ ITENS DO INVENTARIO ============
inventario.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT i.*, f.nome as fornecedor_nome, f.contato as fornecedor_contato, f.endereco as fornecedor_endereco
    FROM inventario i
    LEFT JOIN fornecedores f ON f.id = i.fornecedor_id
    ORDER BY i.created_at DESC
  `).all();
  return c.json(results);
});

inventario.post('/', async (c) => {
  const { nome, finalidade, quantidade, unidade, valor_compra, fornecedor_id, observacao, foto_url } = await c.req.json();
  if (!nome) return c.json({ error: 'Nome do item obrigatório' }, 400);
  const { results } = await c.env.DB.prepare(
    'INSERT INTO inventario (nome, finalidade, quantidade, unidade, valor_compra, fornecedor_id, observacao, foto_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *'
  ).bind(
    nome.trim(), finalidade || null, quantidade ?? 0, unidade || 'un',
    valor_compra ?? null, fornecedor_id || null, observacao?.trim() || null, foto_url || null
  ).all();
  return c.json(results[0], 201);
});

// Upload de foto do item (R2)
inventario.post('/upload', async (c) => {
  const formData = await c.req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return c.json({ error: 'Nenhum arquivo enviado' }, 400);
  if (file.size > 5 * 1024 * 1024) return c.json({ error: 'Arquivo deve ter no máximo 5MB' }, 400);
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  if (!['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return c.json({ error: 'Formato não suportado. Use: jpg, png, webp, gif' }, 400);
  const key = `inventario/${crypto.randomUUID()}.${ext}`;
  await c.env.IMAGES.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
  return c.json({ url: `/api/images/${key}` });
});

inventario.put('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const fields: string[] = [];
  const values: unknown[] = [];
  if ('nome' in body) { fields.push('nome = ?'); values.push(body.nome); }
  if ('finalidade' in body) { fields.push('finalidade = ?'); values.push(body.finalidade || null); }
  if ('quantidade' in body) { fields.push('quantidade = ?'); values.push(body.quantidade ?? 0); }
  if ('unidade' in body) { fields.push('unidade = ?'); values.push(body.unidade || 'un'); }
  if ('valor_compra' in body) { fields.push('valor_compra = ?'); values.push(body.valor_compra ?? null); }
  if ('fornecedor_id' in body) { fields.push('fornecedor_id = ?'); values.push(body.fornecedor_id || null); }
  if ('observacao' in body) { fields.push('observacao = ?'); values.push(body.observacao || null); }
  if ('foto_url' in body) { fields.push('foto_url = ?'); values.push(body.foto_url || null); }
  if (!fields.length) return c.json({ error: 'Nada para atualizar' }, 400);
  values.push(id);
  const { results } = await c.env.DB.prepare(
    `UPDATE inventario SET ${fields.join(', ')} WHERE id = ? RETURNING *`
  ).bind(...values).all();
  if (!results.length) return c.json({ error: 'Item não encontrado' }, 404);
  return c.json(results[0]);
});

inventario.delete('/:id', async (c) => {
  const result = await c.env.DB.prepare('DELETE FROM inventario WHERE id = ?').bind(c.req.param('id')).run();
  if (!result.meta.changes) return c.json({ error: 'Item não encontrado' }, 404);
  return c.json({ ok: true });
});

export default inventario;
