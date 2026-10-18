import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { audit } from '../lib/audit';
import { comRotulo } from '../lib/cafe';
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
// ?de=YYYY-MM-DD&ate=YYYY-MM-DD limita os pedidos considerados (datas no horário de Brasília)
clientes.get('/', authMiddleware, async (c) => {
  const dataValida = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '');
  const de = dataValida(c.req.query('de'));
  const ate = dataValida(c.req.query('ate'));
  const filtros: string[] = [];
  const binds: string[] = [];
  // created_at é UTC; Brasília é UTC-3 sem horário de verão
  if (de) { filtros.push("date(p.created_at, '-3 hours') >= ?"); binds.push(de); }
  if (ate) { filtros.push("date(p.created_at, '-3 hours') <= ?"); binds.push(ate); }
  const filtroPedidos = filtros.map(f => ` AND ${f}`).join('');

  const { results } = await c.env.DB.prepare(`
    SELECT
      cl.id, cl.nome_guerra, cl.saram, cl.ativo, cl.visitante, cl.esquadrao_origem, cl.created_at,
      COALESCE(SUM(p.total), 0) as total_comprado,
      COALESCE(SUM(CASE WHEN p.status = 'pago' THEN p.total ELSE 0 END), 0) as total_pago,
      COALESCE(SUM(CASE WHEN p.status IN ('pendente', 'fiado') THEN p.total ELSE 0 END), 0) as saldo_devedor,
      MAX(p.created_at) as ultima_compra,
      u.id as usuario_id,
      u.categoria as usuario_categoria,
      u.ativo as usuario_ativo
    FROM clientes cl
    LEFT JOIN pedidos p ON p.cliente_id = cl.id${filtroPedidos}
    LEFT JOIN usuarios u ON u.trigrama = cl.nome_guerra COLLATE NOCASE
    GROUP BY cl.id
    ORDER BY cl.nome_guerra ASC
  `).bind(...binds).all();

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

  const antes = await c.env.DB.prepare('SELECT nome_guerra, ativo FROM clientes WHERE id = ?')
    .bind(id).first<{ nome_guerra: string; ativo: number }>();
  if (!antes) return c.json({ error: 'Militar não encontrado' }, 404);

  const { results } = await c.env.DB.prepare(
    'UPDATE clientes SET ativo = ? WHERE id = ? RETURNING *'
  ).bind(ativo ? 1 : 0, id).all();

  if (!results.length) return c.json({ error: 'Militar não encontrado' }, 404);
  await audit(c, ativo ? 'desbloquear_cliente' : 'bloquear_cliente', 'clientes', id, antes, { nome_guerra: antes.nome_guerra, ativo: ativo ? 1 : 0 });
  return c.json(results[0]);
});

// Admin: excluir militar permanentemente
clientes.delete('/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  // Snapshot para auditoria (inclui o saldo em aberto que será apagado junto)
  const antes = await c.env.DB.prepare(
    `SELECT cl.id, cl.nome_guerra, cl.saram, cl.whatsapp, cl.visitante, cl.ativo,
       (SELECT COALESCE(SUM(total), 0) FROM pedidos WHERE cliente_id = cl.id AND status IN ('pendente', 'fiado')) as saldo_cantina,
       (SELECT COALESCE(SUM(total), 0) FROM loja_pedidos WHERE cliente_id = cl.id AND status IN ('pendente', 'fiado')) as saldo_loja,
       (SELECT COALESCE(SUM(cp.valor), 0) FROM cafe_pagamentos cp JOIN cafe_assinantes ca ON ca.id = cp.assinante_id WHERE ca.cliente_id = cl.id AND cp.status = 'pendente') as saldo_cafe
     FROM clientes cl WHERE cl.id = ?`
  ).bind(id).first();
  if (!antes) return c.json({ error: 'Militar não encontrado' }, 404);
  // Tudo num único batch (atômico): ou apaga tudo, ou nada. Antes, uma falha no meio deixava o militar pela metade.
  // Comprovantes são evidência financeira: ficam guardados (com o trigrama), só perdem o vínculo com o cliente apagado.
  const db = c.env.DB;
  const resultados = await db.batch([
    db.prepare('DELETE FROM itens_pedido WHERE pedido_id IN (SELECT id FROM pedidos WHERE cliente_id = ?)').bind(id),
    db.prepare('DELETE FROM pedidos WHERE cliente_id = ?').bind(id),
    db.prepare('DELETE FROM cafe_pagamentos WHERE assinante_id IN (SELECT id FROM cafe_assinantes WHERE cliente_id = ?)').bind(id),
    db.prepare('DELETE FROM cafe_assinantes WHERE cliente_id = ?').bind(id),
    db.prepare('DELETE FROM loja_itens_pedido WHERE pedido_id IN (SELECT id FROM loja_pedidos WHERE cliente_id = ?)').bind(id),
    db.prepare('DELETE FROM loja_parcelas WHERE pedido_id IN (SELECT id FROM loja_pedidos WHERE cliente_id = ?)').bind(id),
    db.prepare('DELETE FROM loja_pedidos WHERE cliente_id = ?').bind(id),
    db.prepare('UPDATE comprovantes SET cliente_id = NULL WHERE cliente_id = ?').bind(id),
    db.prepare('DELETE FROM clientes WHERE id = ?').bind(id),
  ]);
  const result = resultados[resultados.length - 1];
  if (!result.meta.changes) return c.json({ error: 'Militar não encontrado' }, 404);
  await audit(c, 'excluir_cliente', 'clientes', id, antes, null);
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
  `).bind(id).all<{ referencia: string; periodo_fim: string | null }>();

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
    cafe: cafePendentes.map(comRotulo),
    ximboca: ximbocaPendentes,
  });
});

export default clientes;
