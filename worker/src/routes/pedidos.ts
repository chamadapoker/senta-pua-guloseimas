import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import type { AppType } from '../index';
import type { Produto } from '../db/queries';

const pedidos = new Hono<AppType>();

// Público: criar pedido
pedidos.post('/', async (c) => {
  const { nome_guerra, itens, metodo, whatsapp, visitante, esquadrao_origem } = await c.req.json<{
    nome_guerra: string;
    itens: { produto_id: string; quantidade: number }[];
    metodo: 'pix' | 'fiado';
    whatsapp?: string;
    visitante?: boolean;
    esquadrao_origem?: string;
  }>();

  if (!nome_guerra || !itens?.length || !metodo) {
    return c.json({ error: 'nome_guerra, itens e metodo são obrigatórios' }, 400);
  }

  // Buscar ou criar cliente
  let cliente = await c.env.DB.prepare(
    'SELECT id, ativo FROM clientes WHERE nome_guerra = ? COLLATE NOCASE'
  ).bind(nome_guerra).first<{ id: string; ativo: number }>();

  if (cliente && !cliente.ativo) {
    return c.json({ error: 'Militar bloqueado. Procure o responsável da cantina para regularizar sua situação.' }, 403);
  }

  if (!cliente) {
    const { results } = await c.env.DB.prepare(
      'INSERT INTO clientes (nome_guerra, whatsapp, visitante, esquadrao_origem) VALUES (?, ?, ?, ?) RETURNING id'
    ).bind(nome_guerra, whatsapp || null, visitante ? 1 : 0, esquadrao_origem || null).all<{ id: string }>();
    cliente = { ...results[0], ativo: 1 };
  } else if (whatsapp) {
    await c.env.DB.prepare('UPDATE clientes SET whatsapp = ? WHERE id = ?').bind(whatsapp, cliente.id).run();
  }

  if (cliente && visitante) {
    await c.env.DB.prepare('UPDATE clientes SET visitante = 1, esquadrao_origem = ? WHERE id = ?').bind(esquadrao_origem || null, cliente.id).run();
  }

  // Buscar produtos e calcular total
  const produtoIds = itens.map(i => i.produto_id);
  const placeholders = produtoIds.map(() => '?').join(',');
  const { results: produtos } = await c.env.DB.prepare(
    `SELECT * FROM produtos WHERE id IN (${placeholders}) AND disponivel = 1`
  ).bind(...produtoIds).all<Produto>();

  if (produtos.length !== itens.length) {
    return c.json({ error: 'Um ou mais produtos indisponíveis' }, 400);
  }

  const produtoMap = new Map(produtos.map(p => [p.id, p]));

  // Validar estoque antes de calcular
  for (const item of itens) {
    const produto = produtoMap.get(item.produto_id)!;
    if (produto.estoque !== null && item.quantidade > produto.estoque) {
      return c.json({ error: `Estoque insuficiente para ${produto.nome} (disponível: ${produto.estoque})` }, 400);
    }
  }

  let total = 0;
  const itensCalculados = itens.map(item => {
    const produto = produtoMap.get(item.produto_id)!;
    const subtotal = produto.preco * item.quantidade;
    total += subtotal;
    return {
      produto_id: item.produto_id,
      nome_produto: produto.nome,
      preco_unitario: produto.preco,
      quantidade: item.quantidade,
      subtotal,
    };
  });

  total = Math.round(total * 100) / 100;
  const status = metodo === 'fiado' ? 'fiado' : 'pendente';

  // Inserir pedido
  const { results: pedidoResult } = await c.env.DB.prepare(
    'INSERT INTO pedidos (cliente_id, total, status, metodo_pagamento) VALUES (?, ?, ?, ?) RETURNING id'
  ).bind(cliente.id, total, status, metodo).all<{ id: string }>();

  const pedidoId = pedidoResult[0].id;

  // Inserir itens
  const batch = itensCalculados.map(item =>
    c.env.DB.prepare(
      'INSERT INTO itens_pedido (pedido_id, produto_id, nome_produto, preco_unitario, quantidade, subtotal) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(pedidoId, item.produto_id, item.nome_produto, item.preco_unitario, item.quantidade, item.subtotal)
  );
  await c.env.DB.batch(batch);

  // Decrementar estoque e auto-esgotado
  const estoqueUpdates = itensCalculados.map(item =>
    c.env.DB.prepare(
      "UPDATE produtos SET estoque = MAX(estoque - ?, 0) WHERE id = ? AND estoque IS NOT NULL"
    ).bind(item.quantidade, item.produto_id)
  );
  if (estoqueUpdates.length) await c.env.DB.batch(estoqueUpdates);

  // Auto-esgotado: marcar como indisponível se estoque chegou a 0
  await c.env.DB.prepare(
    "UPDATE produtos SET disponivel = 0 WHERE estoque IS NOT NULL AND estoque <= 0"
  ).run();

  return c.json({ pedido_id: pedidoId, total, status }, 201);
});

// Público: status do pedido (para polling PIX)
pedidos.get('/:id', async (c) => {
  const id = c.req.param('id');
  const pedido = await c.env.DB.prepare(
    'SELECT * FROM pedidos WHERE id = ?'
  ).bind(id).first();

  if (!pedido) return c.json({ error: 'Pedido não encontrado' }, 404);
  return c.json(pedido);
});

// Admin: listar pedidos com filtros
pedidos.get('/', authMiddleware, async (c) => {
  const status = c.req.query('status');
  const clienteId = c.req.query('cliente_id');
  const data = c.req.query('data');

  let sql = `
    SELECT p.*, cl.nome_guerra,
      GROUP_CONCAT(ip.nome_produto || ' x' || ip.quantidade, ', ') as itens_resumo
    FROM pedidos p
    JOIN clientes cl ON cl.id = p.cliente_id
    LEFT JOIN itens_pedido ip ON ip.pedido_id = p.id
    WHERE 1=1
  `;
  const params: unknown[] = [];

  if (status) { sql += ' AND p.status = ?'; params.push(status); }
  if (clienteId) { sql += ' AND p.cliente_id = ?'; params.push(clienteId); }
  if (data) { sql += " AND DATE(p.created_at) = ?"; params.push(data); }

  sql += ' GROUP BY p.id ORDER BY p.created_at DESC LIMIT 100';

  const stmt = params.length
    ? c.env.DB.prepare(sql).bind(...params)
    : c.env.DB.prepare(sql);

  const { results } = await stmt.all();
  return c.json(results);
});

// Público: militar confirma que pagou (botão "Já Paguei")
pedidos.put('/:id/confirmar-pagamento', async (c) => {
  const id = c.req.param('id');
  const { results } = await c.env.DB.prepare(
    "UPDATE pedidos SET status = 'pago', paid_at = datetime('now') WHERE id = ? AND status = 'pendente' RETURNING *"
  ).bind(id).all();

  if (!results.length) return c.json({ error: 'Pedido não encontrado ou já processado' }, 404);
  return c.json(results[0]);
});

// Admin: marcar como pago
pedidos.put('/:id/pagar', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const { results } = await c.env.DB.prepare(
    "UPDATE pedidos SET status = 'pago', paid_at = datetime('now') WHERE id = ? AND status != 'pago' RETURNING *"
  ).bind(id).all();

  if (!results.length) return c.json({ error: 'Pedido não encontrado ou já pago' }, 404);
  return c.json(results[0]);
});

// Admin: excluir pedido
pedidos.delete('/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM itens_pedido WHERE pedido_id = ?').bind(id).run();
  const result = await c.env.DB.prepare('DELETE FROM pedidos WHERE id = ?').bind(id).run();

  if (!result.meta.changes) return c.json({ error: 'Pedido não encontrado' }, 404);
  return c.json({ ok: true });
});

export default pedidos;
