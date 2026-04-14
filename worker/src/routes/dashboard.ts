import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import type { AppType } from '../index';

const dashboard = new Hono<AppType>();

// Relatório de lucratividade (cantina + loja)
dashboard.get('/lucratividade', authMiddleware, async (c) => {
  const de = c.req.query('de') || '';
  const ate = c.req.query('ate') || '';

  const dateFilter = (col: string) => {
    const conds: string[] = [];
    const params: string[] = [];
    if (de)  { conds.push(`${col} >= ?`); params.push(de); }
    if (ate) { conds.push(`${col} <= ?`); params.push(ate + ' 23:59:59'); }
    return { where: conds.length ? ' AND ' + conds.join(' AND ') : '', params };
  };

  // Cantina: itens vendidos, custo, receita, lucro
  const f1 = dateFilter('p.created_at');
  const cantinaSql = `
    SELECT
      prod.id, prod.nome, prod.preco, prod.preco_custo,
      SUM(ip.quantidade) as qtd_vendida,
      SUM(ip.subtotal) as receita,
      SUM(ip.quantidade * COALESCE(prod.preco_custo, 0)) as custo_total
    FROM itens_pedido ip
    JOIN pedidos p ON p.id = ip.pedido_id
    JOIN produtos prod ON prod.id = ip.produto_id
    WHERE p.status = 'pago'${f1.where}
    GROUP BY prod.id
    ORDER BY qtd_vendida DESC
  `;
  const cantinaRes = await c.env.DB.prepare(cantinaSql).bind(...f1.params).all<{ id: string; nome: string; preco: number; preco_custo: number | null; qtd_vendida: number; receita: number; custo_total: number }>();

  // Loja: mesma coisa
  const f2 = dateFilter('lp.created_at');
  const lojaSql = `
    SELECT
      prod.id, prod.nome, prod.preco, prod.preco_custo,
      SUM(lip.quantidade) as qtd_vendida,
      SUM(lip.subtotal) as receita,
      SUM(lip.quantidade * COALESCE(prod.preco_custo, 0)) as custo_total
    FROM loja_itens_pedido lip
    JOIN loja_pedidos lp ON lp.id = lip.pedido_id
    JOIN loja_produtos prod ON prod.id = lip.produto_id
    WHERE lp.status = 'pago'${f2.where}
    GROUP BY prod.id
    ORDER BY qtd_vendida DESC
  `;
  const lojaRes = await c.env.DB.prepare(lojaSql).bind(...f2.params).all<{ id: string; nome: string; preco: number; preco_custo: number | null; qtd_vendida: number; receita: number; custo_total: number }>();

  const mapItem = (r: { preco_custo: number | null; receita: number; custo_total: number } & Record<string, unknown>) => {
    const tem_custo = r.preco_custo !== null;
    const lucro = tem_custo ? r.receita - r.custo_total : null;
    const margem = tem_custo && r.receita > 0 ? (lucro! / r.receita) * 100 : null;
    return { ...r, tem_custo, lucro, margem };
  };

  const cantina = cantinaRes.results.map(mapItem);
  const loja = lojaRes.results.map(mapItem);

  const totalizar = (arr: ReturnType<typeof mapItem>[]) => ({
    receita: arr.reduce((s, r) => s + r.receita, 0),
    custo: arr.filter(r => r.tem_custo).reduce((s, r) => s + r.custo_total, 0),
    lucro: arr.filter(r => r.tem_custo).reduce((s, r) => s + (r.lucro || 0), 0),
    sem_custo_count: arr.filter(r => !r.tem_custo).length,
  });

  return c.json({
    cantina: { itens: cantina, totais: totalizar(cantina) },
    loja:    { itens: loja,    totais: totalizar(loja) },
  });
});

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
