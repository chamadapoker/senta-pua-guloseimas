import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import type { AppType } from '../index';

const loja = new Hono<AppType>();

// PUBLIC: list available products with variations
loja.get('/produtos', async (c) => {
  const { results: produtos } = await c.env.DB.prepare(
    'SELECT * FROM loja_produtos WHERE disponivel = 1 ORDER BY ordem ASC'
  ).all();

  // Get variations for each product
  const produtoIds = produtos.map((p: any) => p.id);
  if (produtoIds.length === 0) return c.json([]);

  const placeholders = produtoIds.map(() => '?').join(',');
  const { results: variacoes } = await c.env.DB.prepare(
    `SELECT * FROM loja_variacoes WHERE produto_id IN (${placeholders})`
  ).bind(...produtoIds).all();

  const { results: imagens } = await c.env.DB.prepare(
    `SELECT * FROM loja_produto_imagens WHERE produto_id IN (${placeholders}) ORDER BY ordem ASC`
  ).bind(...produtoIds).all();

  const produtosComVariacoes = produtos.map((p: any) => ({
    ...p,
    variacoes: variacoes.filter((v: any) => v.produto_id === p.id),
    imagens: imagens.filter((i: any) => i.produto_id === p.id),
  }));

  return c.json(produtosComVariacoes);
});

// PUBLIC: create order (same trigrama flow as guloseimas)
loja.post('/pedidos', async (c) => {
  const { nome_guerra, itens, metodo, whatsapp, parcelas, visitante, esquadrao_origem } = await c.req.json<{
    nome_guerra: string;
    itens: { produto_id: string; variacao_id?: string; quantidade: number }[];
    metodo: 'pix' | 'fiado';
    whatsapp?: string;
    parcelas?: number;
    visitante?: boolean;
    esquadrao_origem?: string;
  }>();

  if (!nome_guerra || !itens?.length || !metodo) {
    return c.json({ error: 'nome_guerra, itens e metodo são obrigatórios' }, 400);
  }

  // Reuse same client table
  let cliente = await c.env.DB.prepare(
    'SELECT id, ativo FROM clientes WHERE nome_guerra = ? COLLATE NOCASE'
  ).bind(nome_guerra).first<{ id: string; ativo: number }>();

  if (cliente && !cliente.ativo) {
    return c.json({ error: 'Militar bloqueado.' }, 403);
  }

  if (!cliente) {
    const { results } = await c.env.DB.prepare(
      'INSERT INTO clientes (nome_guerra, whatsapp, visitante, esquadrao_origem) VALUES (?, ?, ?, ?) RETURNING id'
    ).bind(nome_guerra, whatsapp || null, visitante ? 1 : 0, esquadrao_origem || null).all<{ id: string }>();
    cliente = { ...results[0], ativo: 1 };
  } else if (visitante) {
    await c.env.DB.prepare('UPDATE clientes SET visitante = 1, esquadrao_origem = ? WHERE id = ?').bind(esquadrao_origem || null, cliente.id).run();
  }

  // Calculate total
  let total = 0;
  const itensCalculados = [];

  for (const item of itens) {
    const produto = await c.env.DB.prepare(
      'SELECT * FROM loja_produtos WHERE id = ? AND disponivel = 1'
    ).bind(item.produto_id).first<any>();
    if (!produto) return c.json({ error: 'Produto indisponível' }, 400);

    let nomeVariacao = null;
    if (item.variacao_id) {
      const variacao = await c.env.DB.prepare(
        'SELECT * FROM loja_variacoes WHERE id = ? AND produto_id = ?'
      ).bind(item.variacao_id, item.produto_id).first<any>();
      if (!variacao || variacao.estoque < item.quantidade) {
        return c.json({ error: `Estoque insuficiente para ${produto.nome}` }, 400);
      }
      nomeVariacao = variacao.nome;
    }

    const subtotal = produto.preco * item.quantidade;
    total += subtotal;
    itensCalculados.push({
      produto_id: item.produto_id,
      variacao_id: item.variacao_id || null,
      nome_produto: produto.nome,
      nome_variacao: nomeVariacao,
      preco_unitario: produto.preco,
      quantidade: item.quantidade,
      subtotal,
    });
  }

  total = Math.round(total * 100) / 100;
  const status = metodo === 'fiado' ? 'fiado' : 'pendente';

  const { results: pedidoResult } = await c.env.DB.prepare(
    'INSERT INTO loja_pedidos (cliente_id, total, status, metodo_pagamento) VALUES (?, ?, ?, ?) RETURNING id'
  ).bind(cliente.id, total, status, metodo).all<{ id: string }>();

  const pedidoId = pedidoResult[0].id;

  const batch = itensCalculados.map(item =>
    c.env.DB.prepare(
      'INSERT INTO loja_itens_pedido (pedido_id, produto_id, variacao_id, nome_produto, nome_variacao, preco_unitario, quantidade, subtotal) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(pedidoId, item.produto_id, item.variacao_id, item.nome_produto, item.nome_variacao, item.preco_unitario, item.quantidade, item.subtotal)
  );

  // Decrement variation stock
  const estoqueUpdates = itensCalculados
    .filter(item => item.variacao_id)
    .map(item =>
      c.env.DB.prepare(
        'UPDATE loja_variacoes SET estoque = MAX(estoque - ?, 0) WHERE id = ?'
      ).bind(item.quantidade, item.variacao_id)
    );

  await c.env.DB.batch([...batch, ...estoqueUpdates]);

  // Generate parcelas
  const numParcelas = Math.min(Math.max(parseInt(String(parcelas)) || 1, 1), 3);
  const valorParcela = Math.round((total / numParcelas) * 100) / 100;
  const parcelaBatch = [];
  for (let i = 1; i <= numParcelas; i++) {
    // Last parcela absorbs rounding difference
    const val = i === numParcelas ? Math.round((total - valorParcela * (numParcelas - 1)) * 100) / 100 : valorParcela;
    parcelaBatch.push(
      c.env.DB.prepare(
        'INSERT INTO loja_parcelas (pedido_id, numero, total_parcelas, valor) VALUES (?, ?, ?, ?)'
      ).bind(pedidoId, i, numParcelas, val)
    );
  }
  // Update pedido with parcelas count
  parcelaBatch.push(
    c.env.DB.prepare('UPDATE loja_pedidos SET parcelas = ? WHERE id = ?').bind(numParcelas, pedidoId)
  );
  await c.env.DB.batch(parcelaBatch);

  return c.json({ pedido_id: pedidoId, total, status }, 201);
});

// PUBLIC: get order status (for PIX polling)
loja.get('/pedidos/:id', async (c) => {
  const id = c.req.param('id');
  const pedido = await c.env.DB.prepare('SELECT * FROM loja_pedidos WHERE id = ?').bind(id).first();
  if (!pedido) return c.json({ error: 'Pedido não encontrado' }, 404);
  return c.json(pedido);
});

// PUBLIC: confirm payment
loja.put('/pedidos/:id/confirmar-pagamento', async (c) => {
  const id = c.req.param('id');
  const { results } = await c.env.DB.prepare(
    "UPDATE loja_pedidos SET status = 'pago', paid_at = datetime('now') WHERE id = ? AND status = 'pendente' RETURNING *"
  ).bind(id).all();
  if (!results.length) return c.json({ error: 'Pedido não encontrado ou já processado' }, 404);
  return c.json(results[0]);
});

// ADMIN: list all products (including unavailable)
loja.get('/admin/produtos', authMiddleware, async (c) => {
  const { results: produtos } = await c.env.DB.prepare(
    'SELECT * FROM loja_produtos ORDER BY ordem ASC'
  ).all();

  const produtoIds = produtos.map((p: any) => p.id);
  if (produtoIds.length === 0) return c.json([]);

  const placeholders = produtoIds.map(() => '?').join(',');
  const { results: variacoes } = await c.env.DB.prepare(
    `SELECT * FROM loja_variacoes WHERE produto_id IN (${placeholders})`
  ).bind(...produtoIds).all();

  const { results: imagens } = await c.env.DB.prepare(
    `SELECT * FROM loja_produto_imagens WHERE produto_id IN (${placeholders}) ORDER BY ordem ASC`
  ).bind(...produtoIds).all();

  return c.json(produtos.map((p: any) => ({
    ...p,
    variacoes: variacoes.filter((v: any) => v.produto_id === p.id),
    imagens: imagens.filter((i: any) => i.produto_id === p.id),
  })));
});

// ADMIN: create product
loja.post('/admin/produtos', authMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const { nome, descricao, preco, imagem_url, ordem, variacoes, imagens } = body;
    if (!nome || preco == null) return c.json({ error: 'Nome e preço obrigatórios' }, 400);

    const { results } = await c.env.DB.prepare(
      'INSERT INTO loja_produtos (nome, descricao, preco, imagem_url, ordem) VALUES (?, ?, ?, ?, ?) RETURNING *'
    ).bind(nome, descricao || '', preco, imagem_url || null, ordem ?? 0).all();

    const produto = results[0] as any;

    const batch = [];

    // Insert variations
    if (variacoes?.length) {
      for (const v of variacoes) {
        const vNome = v.nome || [v.tamanho, v.cor].filter(Boolean).join(' - ') || 'Variação';
        batch.push(c.env.DB.prepare(
          'INSERT INTO loja_variacoes (produto_id, nome, tamanho, cor, estoque) VALUES (?, ?, ?, ?, ?)'
        ).bind(produto.id, vNome, v.tamanho || null, v.cor || null, parseInt(v.estoque) || 0));
      }
    }

    // Insert images (max 3)
    if (imagens?.length) {
      for (let i = 0; i < Math.min(imagens.length, 3); i++) {
        batch.push(c.env.DB.prepare(
          'INSERT INTO loja_produto_imagens (produto_id, url, ordem) VALUES (?, ?, ?)'
        ).bind(produto.id, imagens[i].url, i));
      }
    }

    if (batch.length) await c.env.DB.batch(batch);

    return c.json({ ...produto, _debug: { variacoes_recebidas: variacoes?.length ?? 0, imagens_recebidas: imagens?.length ?? 0, batch_executado: batch.length } }, 201);
  } catch (err: any) {
    return c.json({ error: 'Erro interno: ' + (err?.message || String(err)) }, 500);
  }
});

// ADMIN: update product
loja.put('/admin/produtos/:id', authMiddleware, async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();

    const fields: string[] = [];
    const values: unknown[] = [];

    if ('nome' in body) { fields.push('nome = ?'); values.push(body.nome); }
    if ('descricao' in body) { fields.push('descricao = ?'); values.push(body.descricao); }
    if ('preco' in body) { fields.push('preco = ?'); values.push(body.preco); }
    if ('imagem_url' in body) { fields.push('imagem_url = ?'); values.push(body.imagem_url); }
    if ('disponivel' in body) { fields.push('disponivel = ?'); values.push(body.disponivel); }
    if ('ordem' in body) { fields.push('ordem = ?'); values.push(body.ordem); }

    if (fields.length) {
      values.push(id);
      await c.env.DB.prepare(
        `UPDATE loja_produtos SET ${fields.join(', ')} WHERE id = ?`
      ).bind(...values).run();
    }

    // Update variations if provided
    if (Array.isArray(body.variacoes)) {
      await c.env.DB.prepare('DELETE FROM loja_variacoes WHERE produto_id = ?').bind(id).run();
      if (body.variacoes.length) {
        const batch = body.variacoes.map((v: any) => {
          const vNome = v.nome || [v.tamanho, v.cor].filter(Boolean).join(' - ') || 'Variação';
          return c.env.DB.prepare(
            'INSERT INTO loja_variacoes (produto_id, nome, tamanho, cor, estoque) VALUES (?, ?, ?, ?, ?)'
          ).bind(id, vNome, v.tamanho || null, v.cor || null, parseInt(v.estoque) || 0);
        });
        await c.env.DB.batch(batch);
      }
    }

    // Update images if provided
    if (Array.isArray(body.imagens)) {
      await c.env.DB.prepare('DELETE FROM loja_produto_imagens WHERE produto_id = ?').bind(id).run();
      if (body.imagens.length) {
        const batch = body.imagens.slice(0, 3).map((img: any, i: number) =>
          c.env.DB.prepare(
            'INSERT INTO loja_produto_imagens (produto_id, url, ordem) VALUES (?, ?, ?)'
          ).bind(id, img.url, i)
        );
        await c.env.DB.batch(batch);
      }
    }

    const produto = await c.env.DB.prepare('SELECT * FROM loja_produtos WHERE id = ?').bind(id).first();
    return c.json({ ...produto as any, _debug: { variacoes_enviadas: body.variacoes?.length ?? 'não enviado', imagens_enviadas: body.imagens?.length ?? 'não enviado' } });
  } catch (err: any) {
    return c.json({ error: 'Erro interno: ' + (err?.message || String(err)) }, 500);
  }
});

// ADMIN: delete product
loja.delete('/admin/produtos/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM loja_variacoes WHERE produto_id = ?').bind(id).run();
  await c.env.DB.prepare('DELETE FROM loja_produto_imagens WHERE produto_id = ?').bind(id).run();
  const result = await c.env.DB.prepare('DELETE FROM loja_produtos WHERE id = ?').bind(id).run();
  if (!result.meta.changes) return c.json({ error: 'Produto não encontrado' }, 404);
  return c.json({ ok: true });
});

// ADMIN: list orders
loja.get('/admin/pedidos', authMiddleware, async (c) => {
  const status = c.req.query('status');
  let sql = `
    SELECT p.*, p.parcelas, cl.nome_guerra,
      GROUP_CONCAT(ip.nome_produto || COALESCE(' (' || ip.nome_variacao || ')', '') || ' x' || ip.quantidade, ', ') as itens_resumo
    FROM loja_pedidos p
    JOIN clientes cl ON cl.id = p.cliente_id
    LEFT JOIN loja_itens_pedido ip ON ip.pedido_id = p.id
    WHERE 1=1
  `;
  const params: unknown[] = [];
  if (status) { sql += ' AND p.status = ?'; params.push(status); }
  sql += ' GROUP BY p.id ORDER BY p.created_at DESC LIMIT 100';

  const stmt = params.length ? c.env.DB.prepare(sql).bind(...params) : c.env.DB.prepare(sql);
  const { results } = await stmt.all();
  return c.json(results);
});

// ADMIN: mark as paid
loja.put('/admin/pedidos/:id/pagar', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const { results } = await c.env.DB.prepare(
    "UPDATE loja_pedidos SET status = 'pago', paid_at = datetime('now') WHERE id = ? AND status != 'pago' RETURNING *"
  ).bind(id).all();
  if (!results.length) return c.json({ error: 'Pedido não encontrado ou já pago' }, 404);
  return c.json(results[0]);
});

// ADMIN: delete order
loja.delete('/admin/pedidos/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM loja_itens_pedido WHERE pedido_id = ?').bind(id).run();
  const result = await c.env.DB.prepare('DELETE FROM loja_pedidos WHERE id = ?').bind(id).run();
  if (!result.meta.changes) return c.json({ error: 'Pedido não encontrado' }, 404);
  return c.json({ ok: true });
});

// PUBLIC: list parcelas for an order
loja.get('/pedidos/:id/parcelas', async (c) => {
  const id = c.req.param('id');
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM loja_parcelas WHERE pedido_id = ? ORDER BY numero ASC'
  ).bind(id).all();
  return c.json(results);
});

// PUBLIC: confirm parcela payment
loja.put('/parcelas/:id/confirmar', async (c) => {
  const id = c.req.param('id');
  const { results } = await c.env.DB.prepare(
    "UPDATE loja_parcelas SET status = 'pago', paid_at = datetime('now') WHERE id = ? AND status = 'pendente' RETURNING *"
  ).bind(id).all();
  if (!results.length) return c.json({ error: 'Parcela não encontrada' }, 404);

  // Check if all parcelas are paid, then mark order as pago
  const parcela = results[0] as any;
  const pendentes = await c.env.DB.prepare(
    "SELECT COUNT(*) as total FROM loja_parcelas WHERE pedido_id = ? AND status = 'pendente'"
  ).bind(parcela.pedido_id).first<{ total: number }>();

  if (pendentes?.total === 0) {
    await c.env.DB.prepare(
      "UPDATE loja_pedidos SET status = 'pago', paid_at = datetime('now') WHERE id = ?"
    ).bind(parcela.pedido_id).run();
  }

  return c.json(results[0]);
});

// ADMIN: list parcelas for an order
loja.get('/admin/pedidos/:id/parcelas', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM loja_parcelas WHERE pedido_id = ? ORDER BY numero ASC'
  ).bind(id).all();
  return c.json(results);
});

// ADMIN: mark parcela as paid
loja.put('/admin/parcelas/:id/pagar', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const { results } = await c.env.DB.prepare(
    "UPDATE loja_parcelas SET status = 'pago', paid_at = datetime('now') WHERE id = ? AND status = 'pendente' RETURNING *"
  ).bind(id).all();
  if (!results.length) return c.json({ error: 'Parcela não encontrada' }, 404);

  const parcela = results[0] as any;
  const pendentes = await c.env.DB.prepare(
    "SELECT COUNT(*) as total FROM loja_parcelas WHERE pedido_id = ? AND status = 'pendente'"
  ).bind(parcela.pedido_id).first<{ total: number }>();

  if (pendentes?.total === 0) {
    await c.env.DB.prepare(
      "UPDATE loja_pedidos SET status = 'pago', paid_at = datetime('now') WHERE id = ?"
    ).bind(parcela.pedido_id).run();
  }

  return c.json(results[0]);
});

// ADMIN: dashboard stats
loja.get('/admin/stats', authMiddleware, async (c) => {
  const now = new Date();
  const mesAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [vendidoMes, recebidoMes, pendente, vendasHoje] = await Promise.all([
    c.env.DB.prepare("SELECT COALESCE(SUM(total), 0) as valor FROM loja_pedidos WHERE created_at LIKE ? || '%'").bind(mesAtual).first<{ valor: number }>(),
    c.env.DB.prepare("SELECT COALESCE(SUM(total), 0) as valor FROM loja_pedidos WHERE status = 'pago' AND created_at LIKE ? || '%'").bind(mesAtual).first<{ valor: number }>(),
    c.env.DB.prepare("SELECT COALESCE(SUM(total), 0) as valor FROM loja_pedidos WHERE status IN ('pendente', 'fiado')").first<{ valor: number }>(),
    c.env.DB.prepare("SELECT COUNT(*) as valor FROM loja_pedidos WHERE DATE(created_at) = ?").bind(now.toISOString().split('T')[0]).first<{ valor: number }>(),
  ]);

  return c.json({
    vendido_mes: vendidoMes?.valor ?? 0,
    recebido_mes: recebidoMes?.valor ?? 0,
    pendente_total: pendente?.valor ?? 0,
    vendas_hoje: vendasHoje?.valor ?? 0,
  });
});

export default loja;
