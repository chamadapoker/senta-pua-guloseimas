import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import type { AppType } from '../index';

const ximboca = new Hono<AppType>();

// All routes are admin-only
ximboca.use('*', authMiddleware);

// Dashboard stats (across all events)
ximboca.get('/stats', async (c) => {
  const [totalEventos, totalArrecadado, totalGasto, eventosAbertos] = await Promise.all([
    c.env.DB.prepare("SELECT COUNT(*) as v FROM ximboca_eventos").first<{ v: number }>(),
    c.env.DB.prepare("SELECT COALESCE(SUM(COALESCE(p.valor_individual, e.valor_por_pessoa)), 0) as v FROM ximboca_participantes p JOIN ximboca_eventos e ON e.id = p.evento_id WHERE p.status = 'pago'").first<{ v: number }>(),
    c.env.DB.prepare("SELECT COALESCE(SUM(valor), 0) as v FROM ximboca_despesas").first<{ v: number }>(),
    c.env.DB.prepare("SELECT COUNT(*) as v FROM ximboca_eventos WHERE status = 'aberto'").first<{ v: number }>(),
  ]);

  return c.json({
    total_eventos: totalEventos?.v ?? 0,
    total_arrecadado: totalArrecadado?.v ?? 0,
    total_gasto: totalGasto?.v ?? 0,
    saldo: (totalArrecadado?.v ?? 0) - (totalGasto?.v ?? 0),
    eventos_abertos: eventosAbertos?.v ?? 0,
  });
});

// List all events with summary
ximboca.get('/eventos', async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT e.*,
      (SELECT COUNT(*) FROM ximboca_participantes p WHERE p.evento_id = e.id) as total_participantes,
      (SELECT COUNT(*) FROM ximboca_participantes p WHERE p.evento_id = e.id AND p.status = 'pago') as total_pagos,
      (SELECT COALESCE(SUM(COALESCE(p.valor_individual, e.valor_por_pessoa)), 0) FROM ximboca_participantes p WHERE p.evento_id = e.id AND p.status = 'pago') as total_arrecadado,
      (SELECT COALESCE(SUM(d.valor), 0) FROM ximboca_despesas d WHERE d.evento_id = e.id) as total_despesas
    FROM ximboca_eventos e
    ORDER BY e.data DESC
  `).all();
  return c.json(results);
});

// Create event
ximboca.post('/eventos', async (c) => {
  const { nome, data, valor_por_pessoa, descricao } = await c.req.json();
  if (!nome || !data) return c.json({ error: 'Nome e data obrigatórios' }, 400);

  const { results } = await c.env.DB.prepare(
    'INSERT INTO ximboca_eventos (nome, data, valor_por_pessoa, descricao) VALUES (?, ?, ?, ?) RETURNING *'
  ).bind(nome, data, valor_por_pessoa ?? 0, descricao || '').all();

  return c.json(results[0], 201);
});

// Get single event with participants and expenses
ximboca.get('/eventos/:id', async (c) => {
  const id = c.req.param('id');
  const evento = await c.env.DB.prepare('SELECT * FROM ximboca_eventos WHERE id = ?').bind(id).first();
  if (!evento) return c.json({ error: 'Evento não encontrado' }, 404);

  const { results: participantes } = await c.env.DB.prepare(
    'SELECT * FROM ximboca_participantes WHERE evento_id = ? ORDER BY nome ASC'
  ).bind(id).all();

  const { results: despesas } = await c.env.DB.prepare(
    'SELECT * FROM ximboca_despesas WHERE evento_id = ? ORDER BY created_at DESC'
  ).bind(id).all();

  return c.json({ evento, participantes, despesas });
});

// Update event
ximboca.put('/eventos/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const fields: string[] = [];
  const values: unknown[] = [];

  if ('nome' in body) { fields.push('nome = ?'); values.push(body.nome); }
  if ('data' in body) { fields.push('data = ?'); values.push(body.data); }
  if ('valor_por_pessoa' in body) { fields.push('valor_por_pessoa = ?'); values.push(body.valor_por_pessoa); }
  if ('descricao' in body) { fields.push('descricao = ?'); values.push(body.descricao); }
  if ('status' in body) { fields.push('status = ?'); values.push(body.status); }

  if (!fields.length) return c.json({ error: 'Nada para atualizar' }, 400);
  values.push(id);

  const { results } = await c.env.DB.prepare(
    `UPDATE ximboca_eventos SET ${fields.join(', ')} WHERE id = ? RETURNING *`
  ).bind(...values).all();

  if (!results.length) return c.json({ error: 'Evento não encontrado' }, 404);
  return c.json(results[0]);
});

// Delete event
ximboca.delete('/eventos/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM ximboca_participantes WHERE evento_id = ?').bind(id).run();
  await c.env.DB.prepare('DELETE FROM ximboca_despesas WHERE evento_id = ?').bind(id).run();
  const result = await c.env.DB.prepare('DELETE FROM ximboca_eventos WHERE id = ?').bind(id).run();
  if (!result.meta.changes) return c.json({ error: 'Evento não encontrado' }, 404);
  return c.json({ ok: true });
});

// Add participant
ximboca.post('/eventos/:id/participantes', async (c) => {
  const evento_id = c.req.param('id');
  const { nome, whatsapp, valor_individual, categoria_consumo } = await c.req.json();
  if (!nome) return c.json({ error: 'Nome obrigatório' }, 400);

  const { results } = await c.env.DB.prepare(
    'INSERT INTO ximboca_participantes (evento_id, nome, whatsapp, valor_individual, categoria_consumo) VALUES (?, ?, ?, ?, ?) RETURNING *'
  ).bind(evento_id, nome.trim().toUpperCase(), whatsapp || null, valor_individual || null, categoria_consumo || 'padrao').all();

  return c.json(results[0], 201);
});

// Mark participant as paid
ximboca.put('/participantes/:id/pagar', async (c) => {
  const id = c.req.param('id');
  const { results } = await c.env.DB.prepare(
    "UPDATE ximboca_participantes SET status = 'pago', paid_at = datetime('now') WHERE id = ? RETURNING *"
  ).bind(id).all();
  if (!results.length) return c.json({ error: 'Participante não encontrado' }, 404);
  return c.json(results[0]);
});

// Remove participant
ximboca.delete('/participantes/:id', async (c) => {
  const id = c.req.param('id');
  const result = await c.env.DB.prepare('DELETE FROM ximboca_participantes WHERE id = ?').bind(id).run();
  if (!result.meta.changes) return c.json({ error: 'Participante não encontrado' }, 404);
  return c.json({ ok: true });
});

// Add expense
ximboca.post('/eventos/:id/despesas', async (c) => {
  const evento_id = c.req.param('id');
  const { descricao, valor, categoria, quantidade, unidade } = await c.req.json();
  if (!descricao || valor == null) return c.json({ error: 'Descrição e valor obrigatórios' }, 400);

  const { results } = await c.env.DB.prepare(
    'INSERT INTO ximboca_despesas (evento_id, descricao, valor, categoria, quantidade, unidade) VALUES (?, ?, ?, ?, ?, ?) RETURNING *'
  ).bind(evento_id, descricao, valor, categoria || 'geral', quantidade || null, unidade || null).all();

  return c.json(results[0], 201);
});

// Remove expense
ximboca.delete('/despesas/:id', async (c) => {
  const id = c.req.param('id');
  const result = await c.env.DB.prepare('DELETE FROM ximboca_despesas WHERE id = ?').bind(id).run();
  if (!result.meta.changes) return c.json({ error: 'Despesa não encontrada' }, 404);
  return c.json({ ok: true });
});

// Estoque CRUD
ximboca.get('/estoque', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM ximboca_estoque ORDER BY nome ASC'
  ).all();
  return c.json(results);
});

ximboca.post('/estoque', async (c) => {
  const { nome, quantidade, unidade, origem_evento } = await c.req.json();
  if (!nome) return c.json({ error: 'Nome obrigatório' }, 400);
  const { results } = await c.env.DB.prepare(
    'INSERT INTO ximboca_estoque (nome, quantidade, unidade, origem_evento) VALUES (?, ?, ?, ?) RETURNING *'
  ).bind(nome, quantidade ?? 0, unidade || 'un', origem_evento || null).all();
  return c.json(results[0], 201);
});

ximboca.put('/estoque/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const fields: string[] = [];
  const values: unknown[] = [];
  if ('nome' in body) { fields.push('nome = ?'); values.push(body.nome); }
  if ('quantidade' in body) { fields.push('quantidade = ?'); values.push(body.quantidade); }
  if ('unidade' in body) { fields.push('unidade = ?'); values.push(body.unidade); }
  if ('origem_evento' in body) { fields.push('origem_evento = ?'); values.push(body.origem_evento); }
  if (!fields.length) return c.json({ error: 'Nada para atualizar' }, 400);
  values.push(id);
  const { results } = await c.env.DB.prepare(
    `UPDATE ximboca_estoque SET ${fields.join(', ')} WHERE id = ? RETURNING *`
  ).bind(...values).all();
  if (!results.length) return c.json({ error: 'Item não encontrado' }, 404);
  return c.json(results[0]);
});

ximboca.delete('/estoque/:id', async (c) => {
  const id = c.req.param('id');
  const result = await c.env.DB.prepare('DELETE FROM ximboca_estoque WHERE id = ?').bind(id).run();
  if (!result.meta.changes) return c.json({ error: 'Item não encontrado' }, 404);
  return c.json({ ok: true });
});

export default ximboca;
