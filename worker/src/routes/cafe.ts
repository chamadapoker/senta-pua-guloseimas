import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { userAuthMiddleware } from '../middleware/userAuth';
import type { AppType } from '../index';

const cafe = new Hono<AppType>();

// PUBLIC: list subscribers and who owes (for the public page)
cafe.get('/devedores', async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT ca.id, cl.nome_guerra, ca.tipo, ca.plano, ca.valor,
      (SELECT COUNT(*) FROM cafe_pagamentos cp WHERE cp.assinante_id = ca.id AND cp.status = 'pendente') as meses_devendo,
      (SELECT COALESCE(SUM(cp.valor), 0) FROM cafe_pagamentos cp WHERE cp.assinante_id = ca.id AND cp.status = 'pendente') as total_devido,
      (SELECT GROUP_CONCAT(cp.id) FROM cafe_pagamentos cp WHERE cp.assinante_id = ca.id AND cp.status = 'pendente') as pagamento_ids_str
    FROM cafe_assinantes ca
    JOIN clientes cl ON cl.id = ca.cliente_id
    WHERE ca.ativo = 1
    ORDER BY cl.nome_guerra ASC
  `).all();

  // Convert comma-separated IDs to array
  const mapped = results.map((r: any) => ({
    ...r,
    pagamento_ids: r.pagamento_ids_str ? r.pagamento_ids_str.split(',') : [],
    pagamento_ids_str: undefined,
  }));

  return c.json(mapped);
});

// Auth: usuário sinaliza que pagou (aprovação final só por comprovante)
cafe.put('/pagamentos/:id/confirmar', userAuthMiddleware, async (c) => {
  const id = c.req.param('id');
  const trigrama = c.get('userTrigrama');
  const pag = await c.env.DB.prepare(
    `SELECT cp.id, cp.status FROM cafe_pagamentos cp
     JOIN cafe_assinantes ca ON ca.id = cp.assinante_id
     JOIN clientes cl ON cl.id = ca.cliente_id
     WHERE cp.id = ? AND cl.nome_guerra = ? COLLATE NOCASE`
  ).bind(id, trigrama).first<{ id: string; status: string }>();
  if (!pag) return c.json({ error: 'Pagamento não encontrado ou não pertence a você' }, 404);
  if (pag.status === 'pago') return c.json({ error: 'Já está pago' }, 400);
  return c.json({ ok: true, mensagem: 'Envie o comprovante para aprovação' });
});

// ADMIN: list all subscribers with payment status
cafe.get('/admin/assinantes', authMiddleware, async (c) => {
  const tipo = c.req.query('tipo');

  let sql = `
    SELECT ca.*, cl.nome_guerra,
      (SELECT COALESCE(SUM(cp.valor), 0) FROM cafe_pagamentos cp WHERE cp.assinante_id = ca.id AND cp.status = 'pago') as total_pago,
      (SELECT COALESCE(SUM(cp.valor), 0) FROM cafe_pagamentos cp WHERE cp.assinante_id = ca.id AND cp.status = 'pendente') as total_devido
    FROM cafe_assinantes ca
    JOIN clientes cl ON cl.id = ca.cliente_id
    WHERE 1=1
  `;
  const params: unknown[] = [];

  if (tipo) { sql += ' AND ca.tipo = ?'; params.push(tipo); }

  sql += ' ORDER BY cl.nome_guerra ASC';

  const stmt = params.length ? c.env.DB.prepare(sql).bind(...params) : c.env.DB.prepare(sql);
  const { results } = await stmt.all();

  return c.json(results);
});

// ADMIN: add subscriber
cafe.post('/admin/assinantes', authMiddleware, async (c) => {
  const { nome_guerra, tipo, plano, valor, visitante, esquadrao_origem } = await c.req.json<{
    nome_guerra: string; tipo: string; plano: string; valor: number;
    visitante?: boolean; esquadrao_origem?: string;
  }>();

  if (!nome_guerra || !tipo || !valor) return c.json({ error: 'Dados obrigatórios' }, 400);

  // Get or create client
  let cliente = await c.env.DB.prepare(
    'SELECT id FROM clientes WHERE nome_guerra = ? COLLATE NOCASE'
  ).bind(nome_guerra).first<{ id: string }>();

  if (!cliente) {
    const { results } = await c.env.DB.prepare(
      'INSERT INTO clientes (nome_guerra, visitante, esquadrao_origem) VALUES (?, ?, ?) RETURNING id'
    ).bind(nome_guerra, visitante ? 1 : 0, esquadrao_origem || null).all<{ id: string }>();
    cliente = results[0];
  } else if (visitante) {
    await c.env.DB.prepare('UPDATE clientes SET visitante = 1, esquadrao_origem = ? WHERE id = ?').bind(esquadrao_origem || null, cliente.id).run();
  }

  // Check if already subscribed
  const existing = await c.env.DB.prepare(
    'SELECT id FROM cafe_assinantes WHERE cliente_id = ? AND ativo = 1'
  ).bind(cliente.id).first();

  if (existing) return c.json({ error: 'Militar já é assinante' }, 400);

  const { results } = await c.env.DB.prepare(
    'INSERT INTO cafe_assinantes (cliente_id, tipo, plano, valor) VALUES (?, ?, ?, ?) RETURNING *'
  ).bind(cliente.id, tipo, plano || 'mensal', valor).all();

  return c.json(results[0], 201);
});

// ADMIN: update subscriber
cafe.put('/admin/assinantes/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();

  const fields: string[] = [];
  const values: unknown[] = [];

  if ('tipo' in body) { fields.push('tipo = ?'); values.push(body.tipo); }
  if ('plano' in body) { fields.push('plano = ?'); values.push(body.plano); }
  if ('valor' in body) { fields.push('valor = ?'); values.push(body.valor); }
  if ('ativo' in body) { fields.push('ativo = ?'); values.push(body.ativo); }

  if (!fields.length) return c.json({ error: 'Nada para atualizar' }, 400);

  values.push(id);
  const { results } = await c.env.DB.prepare(
    `UPDATE cafe_assinantes SET ${fields.join(', ')} WHERE id = ? RETURNING *`
  ).bind(...values).all();

  if (!results.length) return c.json({ error: 'Assinante não encontrado' }, 404);
  return c.json(results[0]);
});

// ADMIN: desativar subscriber (soft delete)
cafe.put('/admin/assinantes/:id/desativar', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const result = await c.env.DB.prepare('UPDATE cafe_assinantes SET ativo = 0 WHERE id = ?').bind(id).run();
  if (!result.meta.changes) return c.json({ error: 'Assinante não encontrado' }, 404);
  return c.json({ ok: true });
});

// ADMIN: excluir subscriber permanentemente
cafe.delete('/admin/assinantes/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  // Excluir pagamentos primeiro
  await c.env.DB.prepare('DELETE FROM cafe_pagamentos WHERE assinante_id = ?').bind(id).run();
  const result = await c.env.DB.prepare('DELETE FROM cafe_assinantes WHERE id = ?').bind(id).run();
  if (!result.meta.changes) return c.json({ error: 'Assinante não encontrado' }, 404);
  return c.json({ ok: true });
});

// ADMIN: create manual charge for a subscriber
cafe.post('/admin/assinantes/:id/cobrar', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const { valor, referencia } = await c.req.json<{ valor: number; referencia: string }>();
  if (!valor || !referencia) return c.json({ error: 'Valor e referência obrigatórios' }, 400);

  const assinante = await c.env.DB.prepare('SELECT id FROM cafe_assinantes WHERE id = ?').bind(id).first();
  if (!assinante) return c.json({ error: 'Assinante não encontrado' }, 404);

  const { results } = await c.env.DB.prepare(
    'INSERT INTO cafe_pagamentos (assinante_id, referencia, valor) VALUES (?, ?, ?) RETURNING *'
  ).bind(id, referencia, valor).all();

  return c.json(results[0], 201);
});

// ADMIN: list payments for a subscriber
cafe.get('/admin/assinantes/:id/pagamentos', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM cafe_pagamentos WHERE assinante_id = ? ORDER BY referencia DESC'
  ).bind(id).all();
  return c.json(results);
});

// ADMIN: generate monthly charges for all active subscribers
// Mensal: referência = "2026-04" (mês)
// Anual: referência = "2026" (ano) — gera só 1x por ano
cafe.post('/admin/gerar-mensalidades', authMiddleware, async (c) => {
  const { referencia, tipo } = await c.req.json<{ referencia: string; tipo?: string }>();
  if (!referencia) return c.json({ error: 'Referência (ex: 2026-04) obrigatória' }, 400);

  // Buscar apenas assinantes MENSAIS — anuais não recebem cobrança mensal
  const assinantesStmt = tipo
    ? c.env.DB.prepare("SELECT * FROM cafe_assinantes WHERE ativo = 1 AND plano = 'mensal' AND tipo = ?").bind(tipo)
    : c.env.DB.prepare("SELECT * FROM cafe_assinantes WHERE ativo = 1 AND plano = 'mensal'");
  const { results: assinantes } = await assinantesStmt.all<{ id: string; valor: number; plano: string }>();

  // Get existing payments for this reference
  const { results: existentes } = await c.env.DB.prepare(
    'SELECT assinante_id FROM cafe_pagamentos WHERE referencia = ?'
  ).bind(referencia).all<{ assinante_id: string }>();

  const jaGerados = new Set(existentes.map(e => e.assinante_id));

  const batch = [];
  for (const a of assinantes) {
    if (!jaGerados.has(a.id)) {
      batch.push(
        c.env.DB.prepare(
          'INSERT INTO cafe_pagamentos (assinante_id, referencia, valor) VALUES (?, ?, ?)'
        ).bind(a.id, referencia, a.valor)
      );
    }
  }

  if (batch.length) await c.env.DB.batch(batch);
  return c.json({ criados: batch.length, total: assinantes.length });
});

// ADMIN: list all payments (mensalidades page)
cafe.get('/admin/mensalidades', authMiddleware, async (c) => {
  const referencia = c.req.query('referencia');
  const status = c.req.query('status');
  const tipo = c.req.query('tipo');

  let sql = `
    SELECT cp.*, cl.nome_guerra, ca.tipo
    FROM cafe_pagamentos cp
    JOIN cafe_assinantes ca ON ca.id = cp.assinante_id
    JOIN clientes cl ON cl.id = ca.cliente_id
    WHERE 1=1
  `;
  const params: unknown[] = [];

  if (referencia) { sql += ' AND cp.referencia = ?'; params.push(referencia); }
  if (status) { sql += ' AND cp.status = ?'; params.push(status); }
  if (tipo) { sql += ' AND ca.tipo = ?'; params.push(tipo); }

  sql += ' ORDER BY cp.referencia DESC, cl.nome_guerra ASC';

  const stmt = params.length ? c.env.DB.prepare(sql).bind(...params) : c.env.DB.prepare(sql);
  const { results } = await stmt.all();
  return c.json(results);
});

// ADMIN: mark payment as paid
cafe.put('/admin/mensalidades/:id/pagar', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const { results } = await c.env.DB.prepare(
    "UPDATE cafe_pagamentos SET status = 'pago', paid_at = datetime('now') WHERE id = ? AND status = 'pendente' RETURNING *"
  ).bind(id).all();
  if (!results.length) return c.json({ error: 'Pagamento não encontrado' }, 404);
  return c.json(results[0]);
});

// ADMIN: insumos CRUD
cafe.get('/admin/insumos', authMiddleware, async (c) => {
  const tipo = c.req.query('tipo');
  let sql = 'SELECT * FROM cafe_insumos';
  const params: unknown[] = [];
  if (tipo) { sql += ' WHERE tipo = ?'; params.push(tipo); }
  sql += ' ORDER BY nome ASC';

  const stmt = params.length ? c.env.DB.prepare(sql).bind(...params) : c.env.DB.prepare(sql);
  const { results } = await stmt.all();
  return c.json(results);
});

cafe.post('/admin/insumos', authMiddleware, async (c) => {
  const { nome, unidade, estoque, estoque_min, tipo } = await c.req.json();
  if (!nome) return c.json({ error: 'Nome obrigatório' }, 400);

  const { results } = await c.env.DB.prepare(
    'INSERT INTO cafe_insumos (nome, unidade, estoque, estoque_min, tipo) VALUES (?, ?, ?, ?, ?) RETURNING *'
  ).bind(nome, unidade || 'un', estoque ?? 0, estoque_min ?? 0, tipo || 'graduado').all();

  return c.json(results[0], 201);
});

cafe.put('/admin/insumos/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();

  const fields: string[] = [];
  const values: unknown[] = [];

  if ('nome' in body) { fields.push('nome = ?'); values.push(body.nome); }
  if ('unidade' in body) { fields.push('unidade = ?'); values.push(body.unidade); }
  if ('estoque' in body) { fields.push('estoque = ?'); values.push(body.estoque); }
  if ('estoque_min' in body) { fields.push('estoque_min = ?'); values.push(body.estoque_min); }
  if ('tipo' in body) { fields.push('tipo = ?'); values.push(body.tipo); }

  if (!fields.length) return c.json({ error: 'Nada para atualizar' }, 400);

  values.push(id);
  const { results } = await c.env.DB.prepare(
    `UPDATE cafe_insumos SET ${fields.join(', ')} WHERE id = ? RETURNING *`
  ).bind(...values).all();

  if (!results.length) return c.json({ error: 'Insumo não encontrado' }, 404);
  return c.json(results[0]);
});

cafe.delete('/admin/insumos/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const result = await c.env.DB.prepare('DELETE FROM cafe_insumos WHERE id = ?').bind(id).run();
  if (!result.meta.changes) return c.json({ error: 'Insumo não encontrado' }, 404);
  return c.json({ ok: true });
});

// ADMIN: dashboard stats (filtro por tipo: ?tipo=oficial ou ?tipo=graduado)
cafe.get('/admin/stats', authMiddleware, async (c) => {
  const tipo = c.req.query('tipo');
  if (tipo && tipo !== 'oficial' && tipo !== 'graduado') {
    return c.json({ error: 'Tipo inválido' }, 400);
  }
  const now = new Date();
  const mesAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [totalAssinantes, recebidoMes, pendente, insumosAlerta] = await Promise.all([
    tipo
      ? c.env.DB.prepare('SELECT COUNT(*) as valor FROM cafe_assinantes WHERE ativo = 1 AND tipo = ?').bind(tipo).first<{ valor: number }>()
      : c.env.DB.prepare('SELECT COUNT(*) as valor FROM cafe_assinantes WHERE ativo = 1').first<{ valor: number }>(),
    tipo
      ? c.env.DB.prepare("SELECT COALESCE(SUM(cp.valor), 0) as valor FROM cafe_pagamentos cp JOIN cafe_assinantes ca ON ca.id = cp.assinante_id WHERE cp.status = 'pago' AND cp.referencia = ? AND ca.tipo = ?").bind(mesAtual, tipo).first<{ valor: number }>()
      : c.env.DB.prepare("SELECT COALESCE(SUM(valor), 0) as valor FROM cafe_pagamentos WHERE status = 'pago' AND referencia = ?").bind(mesAtual).first<{ valor: number }>(),
    tipo
      ? c.env.DB.prepare("SELECT COALESCE(SUM(cp.valor), 0) as valor FROM cafe_pagamentos cp JOIN cafe_assinantes ca ON ca.id = cp.assinante_id WHERE cp.status = 'pendente' AND ca.tipo = ?").bind(tipo).first<{ valor: number }>()
      : c.env.DB.prepare("SELECT COALESCE(SUM(valor), 0) as valor FROM cafe_pagamentos WHERE status = 'pendente'").first<{ valor: number }>(),
    c.env.DB.prepare("SELECT COUNT(*) as valor FROM cafe_insumos WHERE estoque <= estoque_min").first<{ valor: number }>(),
  ]);

  return c.json({
    total_assinantes: totalAssinantes?.valor ?? 0,
    recebido_mes: recebidoMes?.valor ?? 0,
    pendente_total: pendente?.valor ?? 0,
    insumos_alerta: insumosAlerta?.valor ?? 0,
  });
});

// ============ DESPESAS DA CAIXINHA (saida de caixa) ============

// GET lista despesas com filtros opcionais
cafe.get('/admin/despesas', authMiddleware, async (c) => {
  const tipo = c.req.query('tipo');
  const de = c.req.query('de');
  const ate = c.req.query('ate');

  let sql = 'SELECT * FROM cafe_despesas WHERE 1=1';
  const params: unknown[] = [];
  if (tipo) { sql += ' AND tipo = ?'; params.push(tipo); }
  if (de)   { sql += ' AND data >= ?'; params.push(de); }
  if (ate)  { sql += ' AND data <= ?'; params.push(ate); }
  sql += ' ORDER BY data DESC, created_at DESC LIMIT 500';

  const stmt = params.length ? c.env.DB.prepare(sql).bind(...params) : c.env.DB.prepare(sql);
  const { results } = await stmt.all();
  return c.json(results);
});

// POST criar despesa
cafe.post('/admin/despesas', authMiddleware, async (c) => {
  const { tipo, descricao, categoria, valor, data, nota_fiscal, observacao } = await c.req.json();
  if (!tipo || !descricao || !valor) return c.json({ error: 'tipo, descricao e valor obrigatorios' }, 400);
  if (!['oficial', 'graduado'].includes(tipo)) return c.json({ error: 'tipo inválido' }, 400);

  const createdBy = c.get('adminEmail');
  const { results } = await c.env.DB.prepare(
    `INSERT INTO cafe_despesas (tipo, descricao, categoria, valor, data, nota_fiscal, observacao, created_by)
     VALUES (?, ?, ?, ?, COALESCE(?, date('now')), ?, ?, ?) RETURNING *`
  ).bind(tipo, descricao, categoria || 'geral', valor, data || null, nota_fiscal || null, observacao || '', createdBy).all();
  return c.json(results[0], 201);
});

// DELETE remover despesa
cafe.delete('/admin/despesas/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const result = await c.env.DB.prepare('DELETE FROM cafe_despesas WHERE id = ?').bind(id).run();
  if (!result.meta.changes) return c.json({ error: 'Despesa nao encontrada' }, 404);
  return c.json({ ok: true });
});

// GET saldo consolidado (entrou - saiu = saldo) por tipo
cafe.get('/admin/saldo', authMiddleware, async (c) => {
  const tipo = c.req.query('tipo');

  const entradaSql = tipo
    ? "SELECT COALESCE(SUM(cp.valor), 0) as v FROM cafe_pagamentos cp JOIN cafe_assinantes ca ON ca.id = cp.assinante_id WHERE cp.status = 'pago' AND ca.tipo = ?"
    : "SELECT COALESCE(SUM(valor), 0) as v FROM cafe_pagamentos WHERE status = 'pago'";
  const saidaSql = tipo
    ? 'SELECT COALESCE(SUM(valor), 0) as v FROM cafe_despesas WHERE tipo = ?'
    : 'SELECT COALESCE(SUM(valor), 0) as v FROM cafe_despesas';
  const pendenteSql = tipo
    ? "SELECT COALESCE(SUM(cp.valor), 0) as v FROM cafe_pagamentos cp JOIN cafe_assinantes ca ON ca.id = cp.assinante_id WHERE cp.status = 'pendente' AND ca.tipo = ?"
    : "SELECT COALESCE(SUM(valor), 0) as v FROM cafe_pagamentos WHERE status = 'pendente'";

  const [entrada, saida, pendente] = await Promise.all([
    tipo ? c.env.DB.prepare(entradaSql).bind(tipo).first<{ v: number }>() : c.env.DB.prepare(entradaSql).first<{ v: number }>(),
    tipo ? c.env.DB.prepare(saidaSql).bind(tipo).first<{ v: number }>() : c.env.DB.prepare(saidaSql).first<{ v: number }>(),
    tipo ? c.env.DB.prepare(pendenteSql).bind(tipo).first<{ v: number }>() : c.env.DB.prepare(pendenteSql).first<{ v: number }>(),
  ]);

  const e = entrada?.v ?? 0;
  const s = saida?.v ?? 0;
  return c.json({
    total_entrada: e,
    total_saida: s,
    saldo_atual: e - s,
    total_pendente: pendente?.v ?? 0,
    saldo_previsto: e + (pendente?.v ?? 0) - s,
  });
});

export default cafe;
