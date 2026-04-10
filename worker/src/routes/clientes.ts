import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import type { AppType } from '../index';

const clientes = new Hono<AppType>();

// Público: autocomplete nome de guerra
clientes.get('/buscar', async (c) => {
  const q = c.req.query('q') || '';
  if (q.length < 2) return c.json([]);

  const { results } = await c.env.DB.prepare(
    "SELECT id, nome_guerra, visitante, esquadrao_origem FROM clientes WHERE nome_guerra LIKE ? AND ativo = 1 LIMIT 10"
  ).bind(`%${q}%`).all();

  return c.json(results);
});

// Admin: lista clientes com saldo devedor
clientes.get('/', authMiddleware, async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT
      cl.id, cl.nome_guerra, cl.ativo, cl.visitante, cl.esquadrao_origem, cl.created_at,
      COALESCE(SUM(p.total), 0) as total_comprado,
      COALESCE(SUM(CASE WHEN p.status = 'pago' THEN p.total ELSE 0 END), 0) as total_pago,
      COALESCE(SUM(CASE WHEN p.status IN ('pendente', 'fiado') THEN p.total ELSE 0 END), 0) as saldo_devedor,
      MAX(p.created_at) as ultima_compra
    FROM clientes cl
    LEFT JOIN pedidos p ON p.cliente_id = cl.id
    GROUP BY cl.id
    ORDER BY cl.nome_guerra ASC
  `).all();

  return c.json(results);
});

// Admin: extrato do cliente
clientes.get('/:id/extrato', authMiddleware, async (c) => {
  const id = c.req.param('id');

  const cliente = await c.env.DB.prepare(
    'SELECT * FROM clientes WHERE id = ?'
  ).bind(id).first();

  if (!cliente) return c.json({ error: 'Cliente não encontrado' }, 404);

  const { results: pedidos } = await c.env.DB.prepare(`
    SELECT p.*, GROUP_CONCAT(ip.nome_produto || ' x' || ip.quantidade, ', ') as itens_resumo
    FROM pedidos p
    LEFT JOIN itens_pedido ip ON ip.pedido_id = p.id
    WHERE p.cliente_id = ?
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `).bind(id).all();

  return c.json({ cliente, pedidos });
});

// Admin: bloquear/desbloquear militar
clientes.put('/:id/bloquear', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const { ativo } = await c.req.json<{ ativo: number }>();

  const { results } = await c.env.DB.prepare(
    'UPDATE clientes SET ativo = ? WHERE id = ? RETURNING *'
  ).bind(ativo, id).all();

  if (!results.length) return c.json({ error: 'Militar não encontrado' }, 404);
  return c.json(results[0]);
});

// Admin: excluir militar permanentemente
clientes.delete('/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  // Excluir pedidos e itens relacionados
  const { results: pedidos } = await c.env.DB.prepare('SELECT id FROM pedidos WHERE cliente_id = ?').bind(id).all();
  for (const p of pedidos) {
    await c.env.DB.prepare('DELETE FROM itens_pedido WHERE pedido_id = ?').bind((p as any).id).run();
  }
  await c.env.DB.prepare('DELETE FROM pedidos WHERE cliente_id = ?').bind(id).run();
  // Excluir assinante café se existir
  const { results: assinantes } = await c.env.DB.prepare('SELECT id FROM cafe_assinantes WHERE cliente_id = ?').bind(id).all();
  for (const a of assinantes) {
    await c.env.DB.prepare('DELETE FROM cafe_pagamentos WHERE assinante_id = ?').bind((a as any).id).run();
  }
  await c.env.DB.prepare('DELETE FROM cafe_assinantes WHERE cliente_id = ?').bind(id).run();
  // Excluir pedidos loja
  const { results: lojaPedidos } = await c.env.DB.prepare('SELECT id FROM loja_pedidos WHERE cliente_id = ?').bind(id).all();
  for (const p of lojaPedidos) {
    await c.env.DB.prepare('DELETE FROM loja_itens_pedido WHERE pedido_id = ?').bind((p as any).id).run();
    await c.env.DB.prepare('DELETE FROM loja_parcelas WHERE pedido_id = ?').bind((p as any).id).run();
  }
  await c.env.DB.prepare('DELETE FROM loja_pedidos WHERE cliente_id = ?').bind(id).run();
  // Excluir o cliente
  const result = await c.env.DB.prepare('DELETE FROM clientes WHERE id = ?').bind(id).run();
  if (!result.meta.changes) return c.json({ error: 'Militar não encontrado' }, 404);
  return c.json({ ok: true });
});

// Admin: extrato unificado (todos os sistemas)
clientes.get('/:id/extrato-completo', authMiddleware, async (c) => {
  const id = c.req.param('id');

  const cliente = await c.env.DB.prepare('SELECT * FROM clientes WHERE id = ?').bind(id).first();
  if (!cliente) return c.json({ error: 'Cliente não encontrado' }, 404);

  // Guloseimas pedidos
  const { results: pedidosGuloseimas } = await c.env.DB.prepare(`
    SELECT p.*, GROUP_CONCAT(ip.nome_produto || ' x' || ip.quantidade, ', ') as itens_resumo
    FROM pedidos p
    LEFT JOIN itens_pedido ip ON ip.pedido_id = p.id
    WHERE p.cliente_id = ?
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `).bind(id).all();

  // Loja pedidos
  const { results: pedidosLoja } = await c.env.DB.prepare(`
    SELECT p.*, GROUP_CONCAT(ip.nome_produto || COALESCE(' (' || ip.nome_variacao || ')', '') || ' x' || ip.quantidade, ', ') as itens_resumo
    FROM loja_pedidos p
    LEFT JOIN loja_itens_pedido ip ON ip.pedido_id = p.id
    WHERE p.cliente_id = ?
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `).bind(id).all();

  // Café mensalidades pendentes
  const { results: cafePendentes } = await c.env.DB.prepare(`
    SELECT cp.*, ca.tipo as cafe_tipo, ca.plano as cafe_plano
    FROM cafe_pagamentos cp
    JOIN cafe_assinantes ca ON ca.id = cp.assinante_id
    WHERE ca.cliente_id = ?
    ORDER BY cp.referencia DESC
  `).bind(id).all();

  // Ximbóca participações
  const { results: ximbocaPendentes } = await c.env.DB.prepare(`
    SELECT xp.*, xe.nome as evento_nome, xe.data as evento_data, xe.valor_por_pessoa
    FROM ximboca_participantes xp
    JOIN ximboca_eventos xe ON xe.id = xp.evento_id
    WHERE xp.nome = (SELECT nome_guerra FROM clientes WHERE id = ?)
    ORDER BY xe.data DESC
  `).bind(id).all();

  return c.json({
    cliente,
    guloseimas: pedidosGuloseimas,
    loja: pedidosLoja,
    cafe: cafePendentes,
    ximboca: ximbocaPendentes,
  });
});

export default clientes;
