import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { userAuthMiddleware } from '../middleware/userAuth';
import { visitorActiveCheck } from '../middleware/visitorActiveCheck';
import { podeFazerFiado } from '../lib/fiado';
import { resolverClienteDoPedido } from '../lib/cliente';
import { audit } from '../lib/audit';
import type { AppType } from '../index';
import type { Produto } from '../db/queries';

const pedidos = new Hono<AppType>();

// Auth: criar pedido (o checkout da cantina exige login; bloqueia visitante expirado/pausado)
pedidos.post('/', userAuthMiddleware, visitorActiveCheck, async (c) => {
  // nome_guerra/whatsapp/visitante do body são ignorados: o dono é o usuário do token
  const { itens, metodo } = await c.req.json<{
    nome_guerra?: string;
    itens: { produto_id: string; quantidade: number }[];
    metodo: 'pix' | 'fiado' | 'dinheiro';
  }>();

  if (!itens?.length || !metodo) {
    return c.json({ error: 'itens e metodo são obrigatórios' }, 400);
  }
  if (!['pix', 'fiado', 'dinheiro'].includes(metodo)) {
    return c.json({ error: 'Método de pagamento inválido' }, 400);
  }

  if (itens.some(i => !Number.isInteger(i.quantidade) || i.quantidade < 1)) {
    return c.json({ error: 'Quantidade inválida' }, 400);
  }

  // Valida permissao de fiado
  const fiadoCheck = await podeFazerFiado(c, metodo);
  if (!fiadoCheck.ok) return c.json({ error: fiadoCheck.erro }, 403);

  // Buscar ou criar cliente (sempre o do usuário logado)
  const resolvido = await resolverClienteDoPedido(c, {}, 'Militar bloqueado. Procure o responsável da cantina para regularizar sua situação.');
  if (!resolvido.ok) return c.json({ error: resolvido.erro }, resolvido.status);
  const cliente = resolvido.cliente;

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

  // NOTIFICAÇÃO AUTOMÁTICA (se for militar logado)
  const userTrigrama = c.get('userTrigrama');
  if (userTrigrama && metodo === 'fiado') {
    try {
      await c.env.DB.prepare(
        "INSERT INTO notificacoes (trigrama, titulo, mensagem) VALUES (?, 'NOVA COMPRA', ?)"
      ).bind(
        userTrigrama, 
        `Compra de guloseimas realizada no valor de R$ ${total.toFixed(2)}. Não esqueça de regularizar seu saldo!`
      ).run();
    } catch (err) {
      console.error('Erro ao enviar notificação de compra:', err);
    }
  }

  return c.json({ pedido_id: pedidoId, total, status }, 201);
});

// Público: status do pedido (para polling PIX)
pedidos.get('/:id', async (c) => {
  const id = c.req.param('id');
  // Rota pública (polling do PIX em PixPage/usePixPolling): só o que a tela usa (total e status).
  // Nunca cliente_id ou outros dados do militar.
  const pedido = await c.env.DB.prepare(
    'SELECT id, total, status, metodo_pagamento, created_at, paid_at FROM pedidos WHERE id = ?'
  ).bind(id).first();

  if (!pedido) return c.json({ error: 'Pedido não encontrado' }, 404);
  return c.json(pedido);
});

// Admin: listar pedidos com filtros + paginacao
pedidos.get('/', authMiddleware, async (c) => {
  const status = c.req.query('status');
  const clienteId = c.req.query('cliente_id');
  const data = c.req.query('data');
  const de = c.req.query('de');
  const ate = c.req.query('ate');
  const q = c.req.query('q');
  const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 200);
  const offset = Math.max(parseInt(c.req.query('offset') || '0', 10), 0);

  const conds: string[] = ['1=1'];
  const params: unknown[] = [];
  if (status)    { conds.push('p.status = ?'); params.push(status); }
  if (clienteId) { conds.push('p.cliente_id = ?'); params.push(clienteId); }
  if (data)      { conds.push('DATE(p.created_at) = ?'); params.push(data); }
  if (de)        { conds.push('p.created_at >= ?'); params.push(de); }
  if (ate)       { conds.push('p.created_at <= ?'); params.push(ate + ' 23:59:59'); }
  if (q)         { conds.push('cl.nome_guerra LIKE ? COLLATE NOCASE'); params.push(`%${q}%`); }

  const where = conds.join(' AND ');

  const totalRow = await c.env.DB.prepare(
    `SELECT COUNT(DISTINCT p.id) as total FROM pedidos p JOIN clientes cl ON cl.id = p.cliente_id WHERE ${where}`
  ).bind(...params).first<{ total: number }>();

  const { results } = await c.env.DB.prepare(
    `SELECT p.*, cl.nome_guerra,
       GROUP_CONCAT(ip.nome_produto || ' x' || ip.quantidade, ', ') as itens_resumo
     FROM pedidos p
     JOIN clientes cl ON cl.id = p.cliente_id
     LEFT JOIN itens_pedido ip ON ip.pedido_id = p.id
     WHERE ${where}
     GROUP BY p.id
     ORDER BY p.created_at DESC
     LIMIT ? OFFSET ?`
  ).bind(...params, limit, offset).all();

  return c.json({ items: results, total: totalRow?.total || 0, limit, offset });
});

// Auth: militar confirma que pagou (valida que o pedido é dele)
pedidos.put('/:id/confirmar-pagamento', userAuthMiddleware, async (c) => {
  const id = c.req.param('id');
  const trigrama = c.get('userTrigrama');

  const pedido = await c.env.DB.prepare(
    `SELECT p.id, p.status FROM pedidos p
     JOIN clientes cl ON cl.id = p.cliente_id
     WHERE p.id = ? AND cl.nome_guerra = ? COLLATE NOCASE`
  ).bind(id, trigrama).first<{ id: string; status: string }>();

  if (!pedido) return c.json({ error: 'Pedido não encontrado ou não pertence a você' }, 404);
  if (pedido.status === 'pago') return c.json({ error: 'Pedido já está pago' }, 400);

  // Marca como aguardando_confirmacao (requer aprovação via comprovante) —
  // mantém status 'pendente' mas registra intent. A aprovação oficial vem pelo comprovante.
  return c.json({ ok: true, mensagem: 'Envie o comprovante para aprovação' });
});

// Admin: marcar como pago
pedidos.put('/:id/pagar', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const { results } = await c.env.DB.prepare(
    "UPDATE pedidos SET status = 'pago', paid_at = datetime('now') WHERE id = ? AND status != 'pago' RETURNING *"
  ).bind(id).all();

  if (!results.length) return c.json({ error: 'Pedido não encontrado ou já pago' }, 404);
  const pedidoPago = results[0] as { id: string; cliente_id: string; total: number; status: string };
  await audit(c, 'pagar_pedido', 'pedidos', id, null, { total: pedidoPago.total, cliente_id: pedidoPago.cliente_id });

  // NOTIFICAÇÃO AUTOMÁTICA
  try {
    const cliente = await c.env.DB.prepare("SELECT nome_guerra FROM clientes WHERE id = ?").bind(pedidoPago.cliente_id).first<{ nome_guerra: string }>();
    if (cliente) {
      await c.env.DB.prepare(
        "INSERT INTO notificacoes (trigrama, titulo, mensagem) VALUES (?, 'PAGAMENTO CONFIRMADO', ?)"
      ).bind(
        cliente.nome_guerra, 
        `Seu débito de guloseimas no valor de R$ ${pedidoPago.total.toFixed(2)} foi marcado como PAGO!`
      ).run();
    }
  } catch (err) {
    console.error('Erro ao enviar notificação de baixa manual:', err);
  }

  return c.json(pedidoPago);
});

// Admin: excluir pedido
pedidos.delete('/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const antes = await c.env.DB.prepare(
    'SELECT p.id, p.cliente_id, cl.nome_guerra, p.total, p.status, p.metodo_pagamento, p.created_at FROM pedidos p LEFT JOIN clientes cl ON cl.id = p.cliente_id WHERE p.id = ?'
  ).bind(id).first();
  if (!antes) return c.json({ error: 'Pedido não encontrado' }, 404);

  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM itens_pedido WHERE pedido_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM pedidos WHERE id = ?').bind(id),
  ]);

  await audit(c, 'excluir_pedido', 'pedidos', id, antes, null);
  return c.json({ ok: true });
});

export default pedidos;
