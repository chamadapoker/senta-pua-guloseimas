import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { userAuthMiddleware } from '../middleware/userAuth';
import { audit } from '../lib/audit';
import {
  TIPOS_CAFE, PLANOS_CAFE, type TipoCafe, type PlanoCafe, tipoCafeDaCategoria, valorPadraoCafe,
  mesAtualBrasilia, somarMeses, ehMesValido, inicioProximaAnuidade, fimCoberturaAnual, comRotulo,
  SQL_FIM_ANUIDADE, SQL_EH_ANUIDADE,
} from '../lib/cafe';
import type { AppType } from '../index';

const cafe = new Hono<AppType>();

// ADMIN: lista assinantes e quem deve (nenhuma tela pública usa; expunha ids de pagamento)
cafe.get('/devedores', authMiddleware, async (c) => {
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

// Usuário (conta) vinculado ao trigrama do assinante, se existir
async function usuarioDoTrigrama(db: D1Database, trigrama: string) {
  return db.prepare('SELECT id, categoria FROM usuarios WHERE trigrama = ? COLLATE NOCASE')
    .bind(trigrama).first<{ id: number; categoria: string }>();
}

// ADMIN: lista assinantes com situação de pagamento (?tipo=oficial|graduado)
cafe.get('/admin/assinantes', authMiddleware, async (c) => {
  const tipo = c.req.query('tipo');
  if (tipo && !TIPOS_CAFE.includes(tipo as TipoCafe)) return c.json({ error: 'Tipo inválido' }, 400);

  let sql = `
    SELECT ca.*, cl.nome_guerra,
      (SELECT COALESCE(SUM(cp.valor), 0) FROM cafe_pagamentos cp WHERE cp.assinante_id = ca.id AND cp.status = 'pago') as total_pago,
      (SELECT COALESCE(SUM(cp.valor), 0) FROM cafe_pagamentos cp WHERE cp.assinante_id = ca.id AND cp.status = 'pendente') as total_devido,
      (SELECT COUNT(*) FROM cafe_pagamentos cp WHERE cp.assinante_id = ca.id AND cp.status = 'pendente') as qtd_pendente,
      (SELECT MAX(${SQL_FIM_ANUIDADE}) FROM cafe_pagamentos cp WHERE cp.assinante_id = ca.id AND cp.status = 'pago' AND ${SQL_EH_ANUIDADE}) as valido_ate,
      (SELECT u.categoria FROM usuarios u WHERE u.trigrama = cl.nome_guerra COLLATE NOCASE LIMIT 1) as usuario_categoria
    FROM cafe_assinantes ca
    JOIN clientes cl ON cl.id = ca.cliente_id
    WHERE 1=1
  `;
  const params: unknown[] = [];
  if (tipo) { sql += ' AND ca.tipo = ?'; params.push(tipo); }
  sql += ' ORDER BY cl.nome_guerra ASC';

  const stmt = params.length ? c.env.DB.prepare(sql).bind(...params) : c.env.DB.prepare(sql);
  const { results } = await stmt.all<Record<string, unknown> & { plano: string; tipo: string; valido_ate: string | null }>();

  // valido_ate só faz sentido no anual
  return c.json(results.map(r => ({ ...r, sala: r.tipo, valido_ate: r.plano === 'anual' ? r.valido_ate : null })));
});

// ADMIN: adicionar assinante. A sala vem da categoria do usuário (se houver conta); praça não participa.
// Valor vazio/0 => padrão da sala+plano em Configurações. Já cria a primeira cobrança.
cafe.post('/admin/assinantes', authMiddleware, async (c) => {
  const body = await c.req.json<{
    nome_guerra: string; tipo?: string; plano?: string; valor?: number | string | null;
    visitante?: boolean; esquadrao_origem?: string;
  }>();
  const nome_guerra = (body.nome_guerra || '').trim();
  if (!nome_guerra) return c.json({ error: 'Dados obrigatórios' }, 400);

  const plano = (body.plano || 'mensal') as PlanoCafe;
  if (!PLANOS_CAFE.includes(plano)) return c.json({ error: 'Plano inválido' }, 400);

  // Sala: categoria do usuário manda; sem conta, vale o tipo do body
  const usuario = await usuarioDoTrigrama(c.env.DB, nome_guerra);
  let tipo: TipoCafe | null;
  if (usuario) {
    if (usuario.categoria === 'praca') return c.json({ error: 'Praça não participa do café' }, 409);
    tipo = tipoCafeDaCategoria(usuario.categoria);
  } else {
    tipo = TIPOS_CAFE.includes(body.tipo as TipoCafe) ? (body.tipo as TipoCafe) : null;
  }
  if (!tipo) return c.json({ error: 'Dados obrigatórios' }, 400);

  let valor = typeof body.valor === 'string' ? parseFloat(body.valor.replace(',', '.')) : Number(body.valor ?? 0);
  if (!(valor > 0)) {
    const padrao = await valorPadraoCafe(c.env.DB, tipo, plano);
    if (!padrao) return c.json({ error: 'Informe o valor (ou configure o valor padrão da sala em Configurações)' }, 400);
    valor = padrao;
  }

  // Busca ou cria o cliente
  let cliente = await c.env.DB.prepare(
    'SELECT id FROM clientes WHERE nome_guerra = ? COLLATE NOCASE'
  ).bind(nome_guerra).first<{ id: string }>();

  if (!cliente) {
    const { results } = await c.env.DB.prepare(
      'INSERT INTO clientes (nome_guerra, visitante, esquadrao_origem) VALUES (?, ?, ?) RETURNING id'
    ).bind(nome_guerra, body.visitante ? 1 : 0, body.esquadrao_origem || null).all<{ id: string }>();
    cliente = results[0];
  } else if (body.visitante) {
    await c.env.DB.prepare('UPDATE clientes SET visitante = 1, esquadrao_origem = ? WHERE id = ?').bind(body.esquadrao_origem || null, cliente.id).run();
  }

  const existing = await c.env.DB.prepare(
    'SELECT id FROM cafe_assinantes WHERE cliente_id = ? AND ativo = 1'
  ).bind(cliente.id).first();
  if (existing) return c.json({ error: 'Militar já é assinante' }, 400);

  // Assinante + primeira cobrança na mesma operação (mensal: mês atual; anual: 12 meses a partir do mês atual)
  const id = crypto.randomUUID().replace(/-/g, '');
  const mes = mesAtualBrasilia();
  const periodoFim = plano === 'anual' ? somarMeses(mes, 11) : null;
  const [ins] = await c.env.DB.batch([
    c.env.DB.prepare(
      'INSERT INTO cafe_assinantes (id, cliente_id, tipo, plano, valor) VALUES (?, ?, ?, ?, ?) RETURNING *'
    ).bind(id, cliente.id, tipo, plano, valor),
    c.env.DB.prepare(
      `INSERT INTO cafe_pagamentos (assinante_id, referencia, valor, periodo_fim)
       SELECT ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM cafe_pagamentos WHERE assinante_id = ? AND referencia = ?)`
    ).bind(id, mes, valor, periodoFim, id, mes),
  ]);
  const assinante = ins.results[0] as Record<string, unknown>;
  const primeira = await c.env.DB.prepare(
    'SELECT id, referencia, periodo_fim, valor, status FROM cafe_pagamentos WHERE assinante_id = ? AND referencia = ?'
  ).bind(id, mes).first<{ id: string; referencia: string; periodo_fim: string | null; valor: number; status: string }>();

  await audit(c, 'criar_assinante_cafe', 'cafe_assinantes', id, null, {
    nome_guerra, tipo, plano, valor, tipo_da_categoria: !!usuario,
    primeira_cobranca: primeira?.referencia ?? null, periodo_fim: periodoFim,
  });
  return c.json({ ...assinante, sala: tipo, primeira_cobranca: primeira ? comRotulo(primeira) : null }, 201);
});

// ADMIN: editar assinante. Com conta vinculada, a sala segue a categoria (tipo do body é ignorado).
cafe.put('/admin/assinantes/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();

  const antes = await c.env.DB.prepare(
    'SELECT ca.*, cl.nome_guerra FROM cafe_assinantes ca JOIN clientes cl ON cl.id = ca.cliente_id WHERE ca.id = ?'
  ).bind(id).first<{ id: string; tipo: string; plano: string; valor: number; ativo: number; nome_guerra: string }>();
  if (!antes) return c.json({ error: 'Assinante não encontrado' }, 404);

  const usuario = await usuarioDoTrigrama(c.env.DB, antes.nome_guerra);
  const tipoCategoria = usuario ? tipoCafeDaCategoria(usuario.categoria) : null;
  // Praça não pode ser reativada
  if ('ativo' in body && Number(body.ativo) === 1 && usuario && !tipoCategoria) {
    return c.json({ error: 'Praça não participa do café' }, 409);
  }

  const fields: string[] = [];
  const values: unknown[] = [];

  if (usuario) {
    if (tipoCategoria && tipoCategoria !== antes.tipo) { fields.push('tipo = ?'); values.push(tipoCategoria); }
  } else if ('tipo' in body) {
    if (!TIPOS_CAFE.includes(body.tipo)) return c.json({ error: 'Tipo inválido' }, 400);
    fields.push('tipo = ?'); values.push(body.tipo);
  }
  if ('plano' in body) {
    if (!PLANOS_CAFE.includes(body.plano)) return c.json({ error: 'Plano inválido' }, 400);
    fields.push('plano = ?'); values.push(body.plano);
  }
  if ('valor' in body) {
    if (!(Number(body.valor) > 0)) return c.json({ error: 'Valor inválido' }, 400);
    fields.push('valor = ?'); values.push(Number(body.valor));
  }
  if ('ativo' in body) { fields.push('ativo = ?'); values.push(Number(body.ativo) ? 1 : 0); }

  if (!fields.length) return c.json({ error: 'Nada para atualizar' }, 400);

  values.push(id);
  const { results } = await c.env.DB.prepare(
    `UPDATE cafe_assinantes SET ${fields.join(', ')} WHERE id = ? RETURNING *`
  ).bind(...values).all();

  if (!results.length) return c.json({ error: 'Assinante não encontrado' }, 404);
  await audit(c, 'editar_assinante_cafe', 'cafe_assinantes', id,
    { tipo: antes.tipo, plano: antes.plano, valor: antes.valor, ativo: antes.ativo }, results[0]);
  return c.json(results[0]);
});

// ADMIN: desativar assinante (soft delete)
cafe.put('/admin/assinantes/:id/desativar', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const result = await c.env.DB.prepare('UPDATE cafe_assinantes SET ativo = 0 WHERE id = ?').bind(id).run();
  if (!result.meta.changes) return c.json({ error: 'Assinante não encontrado' }, 404);
  await audit(c, 'desativar_assinante_cafe', 'cafe_assinantes', id, null, { ativo: 0 });
  return c.json({ ok: true });
});

// ADMIN: excluir assinante permanentemente (com os pagamentos)
cafe.delete('/admin/assinantes/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const antes = await c.env.DB.prepare('SELECT * FROM cafe_assinantes WHERE id = ?').bind(id).first();
  if (!antes) return c.json({ error: 'Assinante não encontrado' }, 404);
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM cafe_pagamentos WHERE assinante_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM cafe_assinantes WHERE id = ?').bind(id),
  ]);
  await audit(c, 'excluir_assinante_cafe', 'cafe_assinantes', id, antes, null);
  return c.json({ ok: true });
});

// ADMIN: cobrança manual.
// Mensal: referencia 'YYYY-MM' obrigatória. Anual: anuidade de 12 meses; referencia = mês de início
// ('YYYY-MM'); se vier vazia/fora do formato, começa no mês seguinte à cobertura atual (nunca no passado).
cafe.post('/admin/assinantes/:id/cobrar', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{ valor?: number; referencia?: string; plano?: string }>();

  const assinante = await c.env.DB.prepare('SELECT id, plano, valor FROM cafe_assinantes WHERE id = ?')
    .bind(id).first<{ id: string; plano: PlanoCafe; valor: number }>();
  if (!assinante) return c.json({ error: 'Assinante não encontrado' }, 404);

  const valor = Number(body.valor) > 0 ? Number(body.valor) : assinante.valor;
  const refBody = body.referencia;
  let referencia: string;
  let periodoFim: string | null = null;

  // Plano do body (o front manda { valor, plano: 'anual' } sem referência) ou o do assinante
  const plano: PlanoCafe = PLANOS_CAFE.includes(body.plano as PlanoCafe) ? (body.plano as PlanoCafe) : assinante.plano;

  if (plano === 'anual') {
    referencia = ehMesValido(refBody)
      ? refBody
      : inicioProximaAnuidade(await fimCoberturaAnual(c.env.DB, assinante.id), mesAtualBrasilia());
    periodoFim = somarMeses(referencia, 11);
  } else {
    if (!ehMesValido(refBody)) return c.json({ error: 'Valor e referência (AAAA-MM) obrigatórios' }, 400);
    referencia = refBody;
  }

  const dup = await c.env.DB.prepare('SELECT id FROM cafe_pagamentos WHERE assinante_id = ? AND referencia = ?')
    .bind(id, referencia).first();
  if (dup) return c.json({ error: 'Já existe cobrança para essa referência' }, 409);

  const { results } = await c.env.DB.prepare(
    'INSERT INTO cafe_pagamentos (assinante_id, referencia, valor, periodo_fim) VALUES (?, ?, ?, ?) RETURNING *'
  ).bind(id, referencia, valor, periodoFim).all<{ id: string; referencia: string; periodo_fim: string | null }>();

  await audit(c, 'cobrar_assinante_cafe', 'cafe_pagamentos', results[0].id, null, { assinante_id: id, referencia, periodo_fim: periodoFim, valor });
  return c.json(comRotulo(results[0]), 201);
});

// ADMIN: pagamentos de um assinante (com rótulo legível)
cafe.get('/admin/assinantes/:id/pagamentos', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM cafe_pagamentos WHERE assinante_id = ? ORDER BY referencia DESC'
  ).bind(id).all<{ referencia: string; periodo_fim: string | null }>();
  return c.json(results.map(comRotulo));
});

// ADMIN: gerar mensalidades (só assinantes MENSAIS; anuidades são criadas na adesão e renovadas pelo cron)
cafe.post('/admin/gerar-mensalidades', authMiddleware, async (c) => {
  const { referencia, tipo } = await c.req.json<{ referencia: string; tipo?: string }>();
  if (!ehMesValido(referencia)) return c.json({ error: 'Referência (ex: 2026-04) obrigatória' }, 400);

  const assinantesStmt = tipo
    ? c.env.DB.prepare("SELECT * FROM cafe_assinantes WHERE ativo = 1 AND plano = 'mensal' AND tipo = ?").bind(tipo)
    : c.env.DB.prepare("SELECT * FROM cafe_assinantes WHERE ativo = 1 AND plano = 'mensal'");
  const { results: assinantes } = await assinantesStmt.all<{ id: string; valor: number; plano: string }>();

  // Mensalidades já lançadas nessa referência (anuidade com mesmo início não conta)
  const { results: existentes } = await c.env.DB.prepare(
    'SELECT assinante_id FROM cafe_pagamentos WHERE referencia = ? AND periodo_fim IS NULL'
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
  if (batch.length) await audit(c, 'gerar_mensalidades_cafe', 'cafe_pagamentos', null, null, { referencia, tipo: tipo || null, criados: batch.length });
  return c.json({ criados: batch.length, total: assinantes.length });
});

// ADMIN: lista todos os pagamentos (tela de mensalidades)
cafe.get('/admin/mensalidades', authMiddleware, async (c) => {
  const referencia = c.req.query('referencia');
  const status = c.req.query('status');
  const tipo = c.req.query('tipo');

  let sql = `
    SELECT cp.*, cl.nome_guerra, ca.tipo, ca.plano
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
  const { results } = await stmt.all<{ referencia: string; periodo_fim: string | null }>();
  return c.json(results.map(comRotulo));
});

// ADMIN: mark payment as paid
cafe.put('/admin/mensalidades/:id/pagar', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const { results } = await c.env.DB.prepare(
    "UPDATE cafe_pagamentos SET status = 'pago', paid_at = datetime('now') WHERE id = ? AND status = 'pendente' RETURNING *"
  ).bind(id).all<{ assinante_id: string; referencia: string; periodo_fim: string | null; valor: number }>();
  if (!results.length) return c.json({ error: 'Pagamento não encontrado' }, 404);
  const pag = results[0];
  await audit(c, 'pagar_mensalidade_cafe', 'cafe_pagamentos', id, null, { assinante_id: pag.assinante_id, referencia: pag.referencia, periodo_fim: pag.periodo_fim, valor: pag.valor });
  return c.json(comRotulo(pag));
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

// ADMIN: indicadores por sala (?tipo=oficial|graduado; sem tipo = as duas)
// recebido_mes = tudo que foi pago no mês corrente (paid_at em Brasília), mensalidades + anuidades
cafe.get('/admin/stats', authMiddleware, async (c) => {
  const tipo = c.req.query('tipo') || '';
  if (tipo && !TIPOS_CAFE.includes(tipo as TipoCafe)) {
    return c.json({ error: 'Tipo inválido' }, 400);
  }
  const mesAtual = mesAtualBrasilia();
  const db = c.env.DB;
  const filtroSala = "(? = '' OR ca.tipo = ?)";

  const [assinantes, recebido, pendente, insumosAlerta] = await Promise.all([
    db.prepare(`SELECT COUNT(*) as total,
        COALESCE(SUM(CASE WHEN ca.plano = 'mensal' THEN 1 ELSE 0 END), 0) as mensais,
        COALESCE(SUM(CASE WHEN ca.plano = 'anual' THEN 1 ELSE 0 END), 0) as anuais
      FROM cafe_assinantes ca WHERE ca.ativo = 1 AND ${filtroSala}`)
      .bind(tipo, tipo).first<{ total: number; mensais: number; anuais: number }>(),
    db.prepare(`SELECT COALESCE(SUM(cp.valor), 0) as total,
        COALESCE(SUM(CASE WHEN ${SQL_EH_ANUIDADE} THEN 0 ELSE cp.valor END), 0) as mensal,
        COALESCE(SUM(CASE WHEN ${SQL_EH_ANUIDADE} THEN cp.valor ELSE 0 END), 0) as anual
      FROM cafe_pagamentos cp JOIN cafe_assinantes ca ON ca.id = cp.assinante_id
      WHERE cp.status = 'pago' AND cp.paid_at IS NOT NULL AND strftime('%Y-%m', cp.paid_at, '-3 hours') = ? AND ${filtroSala}`)
      .bind(mesAtual, tipo, tipo).first<{ total: number; mensal: number; anual: number }>(),
    db.prepare(`SELECT COALESCE(SUM(cp.valor), 0) as valor
      FROM cafe_pagamentos cp JOIN cafe_assinantes ca ON ca.id = cp.assinante_id
      WHERE cp.status = 'pendente' AND ${filtroSala}`)
      .bind(tipo, tipo).first<{ valor: number }>(),
    db.prepare("SELECT COUNT(*) as valor FROM cafe_insumos WHERE estoque <= estoque_min AND (? = '' OR tipo = ?)")
      .bind(tipo, tipo).first<{ valor: number }>(),
  ]);

  return c.json({
    tipo: tipo || null,
    mes_referencia: mesAtual,
    total_assinantes: assinantes?.total ?? 0,
    assinantes_mensais: assinantes?.mensais ?? 0,
    assinantes_anuais: assinantes?.anuais ?? 0,
    recebido_mes: recebido?.total ?? 0,
    recebido_mes_mensal: recebido?.mensal ?? 0,
    recebido_mes_anual: recebido?.anual ?? 0,
    pendente_total: pendente?.valor ?? 0,
    insumos_alerta: insumosAlerta?.valor ?? 0,
  });
});

// ============ DESPESAS DA CAIXINHA (saida de caixa) ============

// GET lista despesas com filtros opcionais (?tipo=oficial|graduado&de=&ate=)
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

// POST criar despesa (data padrão = hoje em Brasília)
cafe.post('/admin/despesas', authMiddleware, async (c) => {
  const { tipo, descricao, categoria, valor, data, nota_fiscal, observacao } = await c.req.json();
  if (!tipo || !descricao || !valor) return c.json({ error: 'tipo, descricao e valor obrigatorios' }, 400);
  if (!['oficial', 'graduado'].includes(tipo)) return c.json({ error: 'tipo inválido' }, 400);

  const createdBy = c.get('adminEmail');
  const { results } = await c.env.DB.prepare(
    `INSERT INTO cafe_despesas (tipo, descricao, categoria, valor, data, nota_fiscal, observacao, created_by)
     VALUES (?, ?, ?, ?, COALESCE(?, date('now', '-3 hours')), ?, ?, ?) RETURNING *`
  ).bind(tipo, descricao, categoria || 'geral', valor, data || null, nota_fiscal || null, observacao || '', createdBy).all<{ id: string }>();
  await audit(c, 'criar_despesa_cafe', 'cafe_despesas', results[0].id, null, { tipo, descricao, valor });
  return c.json(results[0], 201);
});

// DELETE remover despesa
cafe.delete('/admin/despesas/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const antes = await c.env.DB.prepare('SELECT * FROM cafe_despesas WHERE id = ?').bind(id).first();
  if (!antes) return c.json({ error: 'Despesa nao encontrada' }, 404);
  await c.env.DB.prepare('DELETE FROM cafe_despesas WHERE id = ?').bind(id).run();
  await audit(c, 'excluir_despesa_cafe', 'cafe_despesas', id, antes, null);
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
