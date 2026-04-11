import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import type { AppType } from '../index';

const dashboard = new Hono<AppType>();

dashboard.get('/stats', authMiddleware, async (c) => {
  const now = new Date();
  const mesAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const hoje = now.toISOString().split('T')[0];

  const [vendidoMes, recebidoMes, pendente, vendasHoje, devedores, ultimos7dias] = await Promise.all([
    c.env.DB.prepare(
      "SELECT COALESCE(SUM(total), 0) as valor FROM pedidos WHERE created_at LIKE ? || '%'"
    ).bind(mesAtual).first<{ valor: number }>(),

    c.env.DB.prepare(
      "SELECT COALESCE(SUM(total), 0) as valor FROM pedidos WHERE status = 'pago' AND created_at LIKE ? || '%'"
    ).bind(mesAtual).first<{ valor: number }>(),

    c.env.DB.prepare(
      "SELECT COALESCE(SUM(total), 0) as valor FROM pedidos WHERE status IN ('pendente', 'fiado')"
    ).first<{ valor: number }>(),

    c.env.DB.prepare(
      "SELECT COUNT(*) as valor FROM pedidos WHERE DATE(created_at) = ?"
    ).bind(hoje).first<{ valor: number }>(),

    c.env.DB.prepare(`
      SELECT cl.id as cliente_id, cl.nome_guerra, cl.whatsapp,
        SUM(p.total) as total_devido
      FROM pedidos p
      JOIN clientes cl ON cl.id = p.cliente_id
      WHERE p.status IN ('pendente', 'fiado')
      GROUP BY cl.id
      ORDER BY total_devido DESC
    `).all(),

    c.env.DB.prepare(`
      SELECT DATE(created_at) as data, COALESCE(SUM(total), 0) as total
      FROM pedidos
      WHERE created_at >= datetime('now', '-7 days')
      GROUP BY DATE(created_at)
      ORDER BY data ASC
    `).all(),
  ]);

  return c.json({
    vendido_mes: vendidoMes?.valor ?? 0,
    recebido_mes: recebidoMes?.valor ?? 0,
    pendente_total: pendente?.valor ?? 0,
    vendas_hoje: vendasHoje?.valor ?? 0,
    devedores: devedores.results,
    ultimos_7_dias: ultimos7dias.results,
  });
});

// Relatório de vendas por período
dashboard.get('/relatorio', authMiddleware, async (c) => {
  const de = c.req.query('de') || '';
  const ate = c.req.query('ate') || '';

  if (!de || !ate) return c.json({ error: 'Parâmetros "de" e "ate" obrigatórios (YYYY-MM-DD)' }, 400);

  const [vendas, porMetodo, porDia, topProdutos, devedores] = await Promise.all([
    // Totais do período
    c.env.DB.prepare(`
      SELECT COUNT(*) as total_pedidos,
        COALESCE(SUM(total), 0) as total_vendido,
        COALESCE(SUM(CASE WHEN status = 'pago' THEN total ELSE 0 END), 0) as total_recebido,
        COALESCE(SUM(CASE WHEN status IN ('pendente','fiado') THEN total ELSE 0 END), 0) as total_pendente
      FROM pedidos WHERE DATE(created_at) >= ? AND DATE(created_at) <= ?
    `).bind(de, ate).first(),

    // Por método de pagamento
    c.env.DB.prepare(`
      SELECT metodo_pagamento, status, COUNT(*) as qtd, COALESCE(SUM(total), 0) as valor
      FROM pedidos WHERE DATE(created_at) >= ? AND DATE(created_at) <= ?
      GROUP BY metodo_pagamento, status ORDER BY valor DESC
    `).bind(de, ate).all(),

    // Vendas por dia
    c.env.DB.prepare(`
      SELECT DATE(created_at) as data, COUNT(*) as pedidos, COALESCE(SUM(total), 0) as total
      FROM pedidos WHERE DATE(created_at) >= ? AND DATE(created_at) <= ?
      GROUP BY DATE(created_at) ORDER BY data ASC
    `).bind(de, ate).all(),

    // Top produtos vendidos
    c.env.DB.prepare(`
      SELECT ip.nome_produto, SUM(ip.quantidade) as qtd_vendida, SUM(ip.subtotal) as total_vendido
      FROM itens_pedido ip
      JOIN pedidos p ON p.id = ip.pedido_id
      WHERE DATE(p.created_at) >= ? AND DATE(p.created_at) <= ?
      GROUP BY ip.nome_produto ORDER BY qtd_vendida DESC LIMIT 15
    `).bind(de, ate).all(),

    // Devedores no período
    c.env.DB.prepare(`
      SELECT cl.nome_guerra, SUM(p.total) as total_devido, COUNT(*) as pedidos
      FROM pedidos p JOIN clientes cl ON cl.id = p.cliente_id
      WHERE p.status IN ('pendente','fiado') AND DATE(p.created_at) >= ? AND DATE(p.created_at) <= ?
      GROUP BY cl.id ORDER BY total_devido DESC
    `).bind(de, ate).all(),
  ]);

  return c.json({
    periodo: { de, ate },
    resumo: vendas,
    por_metodo: porMetodo.results,
    por_dia: porDia.results,
    top_produtos: topProdutos.results,
    devedores: devedores.results,
  });
});

export default dashboard;
