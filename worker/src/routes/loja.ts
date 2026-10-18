import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { userAuthMiddleware } from '../middleware/userAuth';
import { visitorActiveCheck } from '../middleware/visitorActiveCheck';
import { podeFazerFiado } from '../lib/fiado';
import { resolverClienteDoPedido } from '../lib/cliente';
import { pagarPedidoLoja, pagarParcelaLoja } from '../lib/loja';
import { audit } from '../lib/audit';
import type { AppType } from '../index';
import type { Context, Next } from 'hono';

async function checkVisitanteSeLogado(c: Context<AppType>, next: Next) {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) return next();
  return userAuthMiddleware(c, async () => {
    await visitorActiveCheck(c, next);
  });
}

const loja = new Hono<AppType>();

// PUBLIC: categorias (com quantos produtos à venda cada uma tem)
loja.get('/categorias', async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT cat.id, cat.nome, cat.ordem,
      (SELECT COUNT(*) FROM loja_produtos p WHERE p.categoria_id = cat.id AND p.disponivel = 1) as total_produtos
    FROM loja_categorias cat
    ORDER BY cat.ordem ASC, cat.nome ASC
  `).all();
  return c.json(results);
});

// ADMIN: criar categoria
loja.post('/admin/categorias', authMiddleware, async (c) => {
  const { nome } = await c.req.json<{ nome?: string }>().catch(() => ({ nome: '' }));
  const nomeLimpo = (nome || '').trim().replace(/\s+/g, ' ');
  if (!nomeLimpo) return c.json({ error: 'Informe o nome da categoria' }, 400);
  if (nomeLimpo.length > 40) return c.json({ error: 'Nome da categoria muito longo (máximo 40 letras)' }, 400);
  const existe = await c.env.DB.prepare('SELECT id FROM loja_categorias WHERE nome = ? COLLATE NOCASE').bind(nomeLimpo).first();
  if (existe) return c.json({ error: 'Já existe uma categoria com esse nome' }, 409);
  const prox = await c.env.DB.prepare('SELECT COALESCE(MAX(ordem), -1) + 1 as ordem FROM loja_categorias').first<{ ordem: number }>();
  const criada = await c.env.DB.prepare(
    'INSERT INTO loja_categorias (nome, ordem) VALUES (?, ?) RETURNING *'
  ).bind(nomeLimpo, prox?.ordem ?? 0).first();
  await audit(c, 'criar_categoria_loja', 'loja_categorias', String((criada as any)?.id ?? ''), null, criada);
  return c.json({ ...(criada as object), total_produtos: 0 }, 201);
});

// ADMIN: renomear / reordenar categoria
loja.put('/admin/categorias/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{ nome?: string; ordem?: number }>().catch(() => ({} as { nome?: string; ordem?: number }));
  const antes = await c.env.DB.prepare('SELECT * FROM loja_categorias WHERE id = ?').bind(id).first();
  if (!antes) return c.json({ error: 'Categoria não encontrada' }, 404);
  const campos: string[] = [];
  const valores: unknown[] = [];
  if (body.nome !== undefined) {
    const nomeLimpo = String(body.nome).trim().replace(/\s+/g, ' ');
    if (!nomeLimpo) return c.json({ error: 'Informe o nome da categoria' }, 400);
    if (nomeLimpo.length > 40) return c.json({ error: 'Nome da categoria muito longo (máximo 40 letras)' }, 400);
    const dup = await c.env.DB.prepare('SELECT id FROM loja_categorias WHERE nome = ? COLLATE NOCASE AND id != ?').bind(nomeLimpo, id).first();
    if (dup) return c.json({ error: 'Já existe uma categoria com esse nome' }, 409);
    campos.push('nome = ?'); valores.push(nomeLimpo);
  }
  if (body.ordem !== undefined && Number.isFinite(Number(body.ordem))) { campos.push('ordem = ?'); valores.push(Math.trunc(Number(body.ordem))); }
  if (!campos.length) return c.json(antes);
  const depois = await c.env.DB.prepare(`UPDATE loja_categorias SET ${campos.join(', ')} WHERE id = ? RETURNING *`).bind(...valores, id).first();
  await audit(c, 'editar_categoria_loja', 'loja_categorias', id, antes, depois);
  return c.json(depois);
});

// ADMIN: excluir categoria (os produtos ficam sem categoria; nada é apagado além da categoria)
loja.delete('/admin/categorias/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const antes = await c.env.DB.prepare('SELECT * FROM loja_categorias WHERE id = ?').bind(id).first();
  if (!antes) return c.json({ error: 'Categoria não encontrada' }, 404);
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE loja_produtos SET categoria_id = NULL WHERE categoria_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM loja_categorias WHERE id = ?').bind(id),
  ]);
  await audit(c, 'excluir_categoria_loja', 'loja_categorias', id, antes, null);
  return c.json({ ok: true });
});

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

  // preco_custo é dado interno (margem): não sai na rota pública
  const produtosComVariacoes = produtos.map(({ preco_custo: _custo, ...p }: any) => ({
    ...p,
    variacoes: variacoes.filter((v: any) => v.produto_id === p.id),
    imagens: imagens.filter((i: any) => i.produto_id === p.id),
  }));

  return c.json(produtosComVariacoes);
});

// PUBLIC: create order (same trigrama flow as guloseimas)
// Sem login: só PIX/dinheiro (fiado exige login). Logado: o dono é sempre o usuário do token.
loja.post('/pedidos', checkVisitanteSeLogado, async (c) => {
  const { nome_guerra, itens, metodo, whatsapp, parcelas, visitante, esquadrao_origem, entrega_tipo, endereco } = await c.req.json<{
    nome_guerra: string;
    itens: { produto_id: string; variacao_id?: string; quantidade: number }[];
    metodo: 'pix' | 'fiado' | 'dinheiro';
    whatsapp?: string;
    parcelas?: number;
    visitante?: boolean;
    esquadrao_origem?: string;
    entrega_tipo?: 'retirada' | 'envio';
    endereco?: string;
  }>();

  const logado = !!c.get('userId');
  if ((!logado && !nome_guerra) || !itens?.length || !metodo) {
    return c.json({ error: 'nome_guerra, itens e metodo são obrigatórios' }, 400);
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

  // Reuse same client table (logado: cliente do usuário; anônimo: não altera cliente existente)
  const resolvido = await resolverClienteDoPedido(c, { nome_guerra, whatsapp, visitante, esquadrao_origem }, 'Militar bloqueado.');
  if (!resolvido.ok) return c.json({ error: resolvido.erro }, resolvido.status);
  const cliente = resolvido.cliente;

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

  // Entrega: retirada (padrao) ou envio (com endereco + taxa de frete configurada pelo admin)
  const tipoEntrega = entrega_tipo === 'envio' ? 'envio' : 'retirada';
  let frete = 0;
  let envioStatus: string | null = null;
  if (tipoEntrega === 'envio') {
    if (!endereco || !endereco.trim()) return c.json({ error: 'Informe o endereço para envio' }, 400);
    const cfg = await c.env.DB.prepare("SELECT valor FROM configuracoes WHERE chave = 'loja_frete'").first<{ valor: string }>();
    frete = Math.max(0, parseFloat(cfg?.valor || '0') || 0);
    envioStatus = 'a_enviar';
  }
  total = Math.round((total + frete) * 100) / 100;
  const status = metodo === 'fiado' ? 'fiado' : 'pendente';

  // Decrementa estoque das variações de forma atômica (evita oversell sob concorrência).
  // UPDATE condicional: só decrementa se houver estoque; changes=0 => insuficiente.
  const itensComVariacao = itensCalculados.filter(i => i.variacao_id);
  if (itensComVariacao.length) {
    const decResults = await c.env.DB.batch(
      itensComVariacao.map(i =>
        c.env.DB.prepare('UPDATE loja_variacoes SET estoque = estoque - ? WHERE id = ? AND estoque >= ?')
          .bind(i.quantidade, i.variacao_id, i.quantidade)
      )
    );
    const idxFalha = decResults.findIndex(r => (r.meta?.changes ?? 0) === 0);
    if (idxFalha !== -1) {
      // Reverte os que foram decrementados com sucesso e rejeita o pedido.
      const reverter = decResults
        .map((r, idx) => ({ ok: (r.meta?.changes ?? 0) > 0, item: itensComVariacao[idx] }))
        .filter(x => x.ok)
        .map(x => c.env.DB.prepare('UPDATE loja_variacoes SET estoque = estoque + ? WHERE id = ?')
          .bind(x.item.quantidade, x.item.variacao_id));
      if (reverter.length) await c.env.DB.batch(reverter);
      return c.json({ error: `Estoque insuficiente para ${itensComVariacao[idxFalha].nome_produto}` }, 400);
    }
  }

  const { results: pedidoResult } = await c.env.DB.prepare(
    'INSERT INTO loja_pedidos (cliente_id, total, status, metodo_pagamento, entrega_tipo, endereco, frete, envio_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id'
  ).bind(cliente.id, total, status, metodo, tipoEntrega, tipoEntrega === 'envio' ? endereco!.trim() : null, frete, envioStatus).all<{ id: string }>();

  const pedidoId = pedidoResult[0].id;

  const batch = itensCalculados.map(item =>
    c.env.DB.prepare(
      'INSERT INTO loja_itens_pedido (pedido_id, produto_id, variacao_id, nome_produto, nome_variacao, preco_unitario, quantidade, subtotal) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(pedidoId, item.produto_id, item.variacao_id, item.nome_produto, item.nome_variacao, item.preco_unitario, item.quantidade, item.subtotal)
  );

  await c.env.DB.batch(batch);

  // Generate parcelas — limite máximo vem da config (loja_max_parcelas)
  const maxCfg = await c.env.DB.prepare(
    "SELECT valor FROM configuracoes WHERE chave = 'loja_max_parcelas'"
  ).first<{ valor: string }>();
  const maxParcelas = Math.max(parseInt(maxCfg?.valor || '1') || 1, 1);
  const numParcelas = Math.min(Math.max(parseInt(String(parcelas)) || 1, 1), maxParcelas);
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
  // Rota pública (polling do PIX): só o necessário para a tela de pagamento. Nunca cliente_id,
  // endereço, rastreamento ou outros dados pessoais.
  const pedido = await c.env.DB.prepare(
    'SELECT id, total, status, metodo_pagamento, parcelas, created_at, paid_at FROM loja_pedidos WHERE id = ?'
  ).bind(id).first();
  if (!pedido) return c.json({ error: 'Pedido não encontrado' }, 404);
  return c.json(pedido);
});

// USER: meus pedidos da loja
loja.get('/meus-pedidos', userAuthMiddleware, async (c) => {
  const trigrama = c.get('userTrigrama');

  const { results: pedidos } = await c.env.DB.prepare(`
    SELECT p.*, cl.nome_guerra
    FROM loja_pedidos p
    JOIN clientes cl ON cl.id = p.cliente_id
    WHERE cl.nome_guerra = ? COLLATE NOCASE
    ORDER BY p.created_at DESC
    LIMIT 30
  `).bind(trigrama).all<{ id: string; total: number; status: string; metodo_pagamento: string; parcelas: number; created_at: string }>();

  if (pedidos.length === 0) return c.json([]);
  const ids = pedidos.map(p => p.id);
  const placeholders = ids.map(() => '?').join(',');

  const [itensRes, parcelasRes] = await Promise.all([
    c.env.DB.prepare(`SELECT pedido_id, nome_produto, nome_variacao, quantidade, subtotal FROM loja_itens_pedido WHERE pedido_id IN (${placeholders})`).bind(...ids).all<{ pedido_id: string; nome_produto: string; nome_variacao: string | null; quantidade: number; subtotal: number }>(),
    c.env.DB.prepare(`SELECT id, pedido_id, numero, total_parcelas, valor, status FROM loja_parcelas WHERE pedido_id IN (${placeholders}) ORDER BY numero ASC`).bind(...ids).all<{ id: string; pedido_id: string; numero: number; total_parcelas: number; valor: number; status: string }>(),
  ]);

  const itensMap = new Map<string, unknown[]>();
  for (const i of itensRes.results) {
    const arr = itensMap.get(i.pedido_id) || [];
    arr.push(i);
    itensMap.set(i.pedido_id, arr);
  }
  const parcelasMap = new Map<string, unknown[]>();
  for (const p of parcelasRes.results) {
    const arr = parcelasMap.get(p.pedido_id) || [];
    arr.push(p);
    parcelasMap.set(p.pedido_id, arr);
  }

  return c.json(pedidos.map(p => ({
    ...p,
    itens: itensMap.get(p.id) || [],
    parcelas_lista: parcelasMap.get(p.id) || [],
  })));
});

// Auth: usuário sinaliza que pagou (aprovação final só por comprovante)
loja.put('/pedidos/:id/confirmar-pagamento', userAuthMiddleware, async (c) => {
  const id = c.req.param('id');
  const trigrama = c.get('userTrigrama');
  const pedido = await c.env.DB.prepare(
    `SELECT p.id, p.status FROM loja_pedidos p
     JOIN clientes cl ON cl.id = p.cliente_id
     WHERE p.id = ? AND cl.nome_guerra = ? COLLATE NOCASE`
  ).bind(id, trigrama).first<{ id: string; status: string }>();
  if (!pedido) return c.json({ error: 'Pedido não encontrado ou não pertence a você' }, 404);
  if (pedido.status === 'pago') return c.json({ error: 'Pedido já está pago' }, 400);
  return c.json({ ok: true, mensagem: 'Envie o comprovante para aprovação' });
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
  // Erros caem no onError global: 400 para JSON inválido, 500 genérico (detalhe só no log)
  const body = await c.req.json();
  const { nome, descricao, preco, preco_custo, imagem_url, ordem, variacoes, imagens, categoria_id } = body;
  if (!nome || preco == null) return c.json({ error: 'Nome e preço obrigatórios' }, 400);

  const { results } = await c.env.DB.prepare(
    'INSERT INTO loja_produtos (nome, descricao, preco, preco_custo, imagem_url, ordem, disponivel, categoria_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *'
  ).bind(nome, descricao || '', preco, preco_custo ?? null, imagem_url || null, ordem ?? 0, body.disponivel ?? 1, categoria_id || null).all();

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

  return c.json(produto, 201);
});

// ADMIN: update product
loja.put('/admin/produtos/:id', authMiddleware, async (c) => {
  // Erros caem no onError global: 400 para JSON inválido, 500 genérico (detalhe só no log)
  const id = c.req.param('id');
  const body = await c.req.json();

  const fields: string[] = [];
  const values: unknown[] = [];

  if ('nome' in body) { fields.push('nome = ?'); values.push(body.nome); }
  if ('descricao' in body) { fields.push('descricao = ?'); values.push(body.descricao); }
  if ('preco' in body) { fields.push('preco = ?'); values.push(body.preco); }
  if ('preco_custo' in body) { fields.push('preco_custo = ?'); values.push(body.preco_custo); }
  if ('imagem_url' in body) { fields.push('imagem_url = ?'); values.push(body.imagem_url); }
  if ('disponivel' in body) { fields.push('disponivel = ?'); values.push(body.disponivel); }
  if ('ordem' in body) { fields.push('ordem = ?'); values.push(body.ordem); }
  if ('categoria_id' in body) { fields.push('categoria_id = ?'); values.push(body.categoria_id || null); }

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
  return c.json(produto);
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
  // Pedido pago => todas as parcelas pendentes também
  const { pedido, parcelas_quitadas } = await pagarPedidoLoja(c.env.DB, id!);
  if (!pedido) return c.json({ error: 'Pedido não encontrado ou já pago' }, 404);
  await audit(c, 'pagar_pedido_loja', 'loja_pedidos', id, null, { total: pedido.total, cliente_id: pedido.cliente_id, parcelas_quitadas });
  return c.json(pedido);
});

// ADMIN: marcar pedido de envio como enviado (+ rastreio) e avisar o cliente
loja.put('/admin/pedidos/:id/enviar', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const { rastreamento } = await c.req.json<{ rastreamento?: string }>();
  const { results } = await c.env.DB.prepare(
    "UPDATE loja_pedidos SET envio_status = 'enviado', rastreamento = ? WHERE id = ? AND entrega_tipo = 'envio' RETURNING *"
  ).bind(rastreamento?.trim() || null, id).all();
  if (!results.length) return c.json({ error: 'Pedido de envio não encontrado' }, 404);
  try {
    const ped = results[0] as { cliente_id: string; rastreamento: string | null };
    const cl = await c.env.DB.prepare('SELECT nome_guerra FROM clientes WHERE id = ?').bind(ped.cliente_id).first<{ nome_guerra: string }>();
    if (cl) {
      const msg = ped.rastreamento
        ? `Seu pedido da loja foi enviado! Rastreamento: ${ped.rastreamento}`
        : 'Seu pedido da loja foi enviado!';
      await c.env.DB.prepare("INSERT INTO notificacoes (trigrama, titulo, mensagem) VALUES (?, 'PEDIDO ENVIADO', ?)").bind(cl.nome_guerra, msg).run();
    }
  } catch { /* notificação é best-effort */ }
  return c.json(results[0]);
});

// ADMIN: delete order
loja.delete('/admin/pedidos/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const antes = await c.env.DB.prepare(
    'SELECT p.id, p.cliente_id, cl.nome_guerra, p.total, p.status, p.metodo_pagamento, p.parcelas, p.created_at FROM loja_pedidos p LEFT JOIN clientes cl ON cl.id = p.cliente_id WHERE p.id = ?'
  ).bind(id).first();
  if (!antes) return c.json({ error: 'Pedido não encontrado' }, 404);

  // Parcelas também saem (antes ficavam órfãs)
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM loja_itens_pedido WHERE pedido_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM loja_parcelas WHERE pedido_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM loja_pedidos WHERE id = ?').bind(id),
  ]);

  await audit(c, 'excluir_pedido_loja', 'loja_pedidos', id, antes, null);
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

// Auth: usuário sinaliza que pagou a parcela (aprovação final só por comprovante)
loja.put('/parcelas/:id/confirmar', userAuthMiddleware, async (c) => {
  const id = c.req.param('id');
  const trigrama = c.get('userTrigrama');
  const parcela = await c.env.DB.prepare(
    `SELECT lp.id, lp.status FROM loja_parcelas lp
     JOIN loja_pedidos ped ON ped.id = lp.pedido_id
     JOIN clientes cl ON cl.id = ped.cliente_id
     WHERE lp.id = ? AND cl.nome_guerra = ? COLLATE NOCASE`
  ).bind(id, trigrama).first<{ id: string; status: string }>();
  if (!parcela) return c.json({ error: 'Parcela não encontrada ou não pertence a você' }, 404);
  if (parcela.status === 'pago') return c.json({ error: 'Parcela já está paga' }, 400);
  return c.json({ ok: true, mensagem: 'Envie o comprovante para aprovação' });
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
  // Última parcela paga => pedido pago
  const { parcela, pedido_quitado } = await pagarParcelaLoja(c.env.DB, id!);
  if (!parcela) return c.json({ error: 'Parcela não encontrada' }, 404);
  await audit(c, 'pagar_parcela_loja', 'loja_parcelas', id, null, {
    pedido_id: parcela.pedido_id, numero: parcela.numero, valor: parcela.valor, pedido_quitado,
  });
  return c.json(parcela);
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
