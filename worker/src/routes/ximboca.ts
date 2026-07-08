import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { userAuthMiddleware } from '../middleware/userAuth';
import { visitorActiveCheck } from '../middleware/visitorActiveCheck';
import { checkRateLimit, recordAttempt, clientKey } from '../lib/rateLimit';
import type { AppType } from '../index';

const ximboca = new Hono<AppType>();

// ============ ROTA ABERTA (sem login) — pagina compartilhavel do evento ============
// Expoe apenas dados nao-sensiveis (nome, data, capa, valores/tipos, contagem). Sem participantes.
ximboca.get('/publico/evento/:id', async (c) => {
  const id = c.req.param('id');
  const evento = await c.env.DB.prepare(
    'SELECT id, nome, data, descricao, imagem_url, status, valor_por_pessoa, valor_cerveja, valor_refri, inscricao_ate FROM ximboca_eventos WHERE id = ?'
  ).bind(id).first();
  if (!evento) return c.json({ error: 'Evento não encontrado' }, 404);
  const { results: tipos } = await c.env.DB.prepare(
    'SELECT id, nome, valor, ordem FROM ximboca_ingresso_tipos WHERE evento_id = ? ORDER BY ordem ASC, nome ASC'
  ).bind(id).all();
  const total = await c.env.DB.prepare(
    'SELECT COUNT(*) as n FROM ximboca_participantes WHERE evento_id = ?'
  ).bind(id).first<{ n: number }>();
  return c.json({ ...evento, tipos, total_participantes: total?.n ?? 0 });
});

// ============ ROTAS PUBLICAS (usuario logado) ============

// Lista eventos abertos para participar (com valores por categoria)
ximboca.get('/publico/eventos', userAuthMiddleware, visitorActiveCheck, async (c) => {
  const trigrama = c.get('userTrigrama');

  const { results } = await c.env.DB.prepare(`
    SELECT e.*,
      (SELECT COUNT(*) FROM ximboca_participantes p WHERE p.evento_id = e.id) as total_participantes,
      (SELECT id FROM ximboca_participantes p WHERE p.evento_id = e.id AND p.nome = ? COLLATE NOCASE LIMIT 1) as meu_participante_id,
      (SELECT categoria_consumo FROM ximboca_participantes p WHERE p.evento_id = e.id AND p.nome = ? COLLATE NOCASE LIMIT 1) as minha_categoria,
      (SELECT status FROM ximboca_participantes p WHERE p.evento_id = e.id AND p.nome = ? COLLATE NOCASE LIMIT 1) as meu_status
    FROM ximboca_eventos e
    WHERE e.status = 'aberto'
    ORDER BY e.data ASC
  `).bind(trigrama, trigrama, trigrama).all();

  const eventoIds = (results as { id: string }[]).map(e => e.id);
  let tiposPorEvento: Record<string, unknown[]> = {};
  if (eventoIds.length) {
    const ph = eventoIds.map(() => '?').join(',');
    const { results: tipos } = await c.env.DB.prepare(
      `SELECT * FROM ximboca_ingresso_tipos WHERE evento_id IN (${ph}) ORDER BY ordem ASC, nome ASC`
    ).bind(...eventoIds).all();
    tiposPorEvento = (tipos as { evento_id: string }[]).reduce((acc, t) => {
      (acc[t.evento_id] ||= []).push(t); return acc;
    }, {} as Record<string, unknown[]>);
  }
  return c.json((results as { id: string }[]).map(e => ({ ...e, tipos: tiposPorEvento[e.id] || [] })));
});

// Lista eventos que o usuario participa (qualquer status)
ximboca.get('/publico/meus-eventos', userAuthMiddleware, async (c) => {
  const trigrama = c.get('userTrigrama');

  const { results } = await c.env.DB.prepare(`
    SELECT e.*, p.id as participante_id, p.categoria_consumo, p.valor_individual,
           p.status as meu_status, p.paid_at, p.numero_ingresso, p.checkin_at,
           t.nome as tipo_nome
    FROM ximboca_participantes p
    JOIN ximboca_eventos e ON e.id = p.evento_id
    LEFT JOIN ximboca_ingresso_tipos t ON t.id = p.tipo_ingresso_id
    WHERE p.nome = ? COLLATE NOCASE
    ORDER BY e.data DESC
  `).bind(trigrama).all();

  return c.json(results);
});

// Participar de um evento (auto-cria participante com dados do usuario)
ximboca.post('/publico/eventos/:id/participar', userAuthMiddleware, visitorActiveCheck, async (c) => {
  const eventoId = c.req.param('id');
  const trigrama = c.get('userTrigrama');
  const { categoria_consumo, tipo_ingresso_id } = await c.req.json<{ categoria_consumo?: string; tipo_ingresso_id?: string }>();

  const userId = c.get('userId');
  const user = await c.env.DB.prepare('SELECT whatsapp FROM usuarios WHERE id = ?').bind(userId).first<{ whatsapp: string }>();
  const whatsapp = user?.whatsapp || null;

  const evento = await c.env.DB.prepare(
    'SELECT id, status, valor_por_pessoa, valor_cerveja, valor_refri, inscricao_ate FROM ximboca_eventos WHERE id = ?'
  ).bind(eventoId).first<{ id: string; status: string; valor_por_pessoa: number; valor_cerveja: number | null; valor_refri: number | null; inscricao_ate: string | null }>();
  if (!evento) return c.json({ error: 'Evento não encontrado' }, 404);
  if (evento.status !== 'aberto') return c.json({ error: 'Evento está fechado' }, 400);
  if (evento.inscricao_ate) {
    const hojeBRT = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
    if (hojeBRT > evento.inscricao_ate) return c.json({ error: 'As inscrições para este evento estão encerradas' }, 400);
  }

  const exist = await c.env.DB.prepare(
    'SELECT id FROM ximboca_participantes WHERE evento_id = ? AND nome = ? COLLATE NOCASE'
  ).bind(eventoId, trigrama).first();
  if (exist) return c.json({ error: 'Você já está inscrito neste evento' }, 409);

  const cat = (categoria_consumo || 'padrao').toLowerCase();
  let valorIndividual: number | null = null;
  let tipoId: string | null = null;

  if (tipo_ingresso_id) {
    const tipo = await c.env.DB.prepare(
      'SELECT id, valor FROM ximboca_ingresso_tipos WHERE id = ? AND evento_id = ?'
    ).bind(tipo_ingresso_id, eventoId).first<{ id: string; valor: number }>();
    if (!tipo) return c.json({ error: 'Tipo de ingresso inválido' }, 400);
    valorIndividual = tipo.valor;
    tipoId = tipo.id;
  } else if (cat === 'cerveja' && evento.valor_cerveja !== null) {
    valorIndividual = evento.valor_cerveja;
  } else if (cat === 'refri' && evento.valor_refri !== null) {
    valorIndividual = evento.valor_refri;
  }

  const maxNum = await c.env.DB.prepare(
    'SELECT COALESCE(MAX(numero_ingresso), 0) as n FROM ximboca_participantes WHERE evento_id = ?'
  ).bind(eventoId).first<{ n: number }>();
  const numeroIngresso = (maxNum?.n || 0) + 1;

  const { results } = await c.env.DB.prepare(
    'INSERT INTO ximboca_participantes (evento_id, nome, whatsapp, valor_individual, categoria_consumo, tipo_ingresso_id, numero_ingresso) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *'
  ).bind(eventoId, trigrama, whatsapp, valorIndividual, cat, tipoId, numeroIngresso).all();

  return c.json(results[0], 201);
});

// Cancelar participacao (apenas se nao pago)
ximboca.delete('/publico/eventos/:id/participar', userAuthMiddleware, async (c) => {
  const eventoId = c.req.param('id');
  const trigrama = c.get('userTrigrama');

  const part = await c.env.DB.prepare(
    'SELECT id, status FROM ximboca_participantes WHERE evento_id = ? AND nome = ? COLLATE NOCASE'
  ).bind(eventoId, trigrama).first<{ id: string; status: string }>();

  if (!part) return c.json({ error: 'Você não está inscrito' }, 404);
  if (part.status === 'pago') return c.json({ error: 'Participação já paga não pode ser cancelada pelo app' }, 400);

  await c.env.DB.prepare('DELETE FROM ximboca_participantes WHERE id = ?').bind(part.id).run();
  return c.json({ ok: true });
});

// ============ CHECK-IN (recepcionista logado) ============
async function recepcionistaMiddleware(c: import('hono').Context<AppType>, next: import('hono').Next) {
  return userAuthMiddleware(c, async () => {
    const userId = c.get('userId');
    const u = await c.env.DB.prepare('SELECT is_recepcionista FROM usuarios WHERE id = ?')
      .bind(userId).first<{ is_recepcionista: number }>();
    if (!u || u.is_recepcionista !== 1) {
      c.res = c.json({ error: 'Acesso restrito a recepcionistas' }, 403);
      return;
    }
    await next();
  });
}

ximboca.get('/checkin/eventos', recepcionistaMiddleware, async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT e.id, e.nome, e.data, e.imagem_url,
      SUM(CASE WHEN p.status='pago' THEN 1 ELSE 0 END) as total_pagos,
      SUM(CASE WHEN p.status='pago' AND p.checkin_at IS NOT NULL THEN 1 ELSE 0 END) as entraram
    FROM ximboca_eventos e
    LEFT JOIN ximboca_participantes p ON p.evento_id = e.id
    WHERE e.status = 'aberto'
    GROUP BY e.id ORDER BY e.data ASC
  `).all();
  return c.json(results);
});

ximboca.get('/checkin/:eventoId/lista', recepcionistaMiddleware, async (c) => {
  const eventoId = c.req.param('eventoId');
  const q = `%${(c.req.query('q') || '').trim()}%`;
  const { results } = await c.env.DB.prepare(`
    SELECT p.id, p.nome, p.numero_ingresso, p.checkin_at, t.nome as tipo_nome
    FROM ximboca_participantes p
    LEFT JOIN ximboca_ingresso_tipos t ON t.id = p.tipo_ingresso_id
    WHERE p.evento_id = ? AND p.status = 'pago' AND p.nome LIKE ? COLLATE NOCASE
    ORDER BY p.nome ASC LIMIT 50
  `).bind(eventoId, q).all();
  return c.json(results);
});

ximboca.post('/checkin/:eventoId/validar', recepcionistaMiddleware, async (c) => {
  const eventoId = c.req.param('eventoId');
  const trigrama = c.get('userTrigrama');

  const rlKey = `${trigrama}:${clientKey(c)}`;
  const rl = await checkRateLimit(c, 'ximboca_checkin_fail', rlKey, 30, 15);
  if (!rl.ok) return c.json({ error: 'Muitas tentativas inválidas. Aguarde alguns minutos.' }, 429);

  const { participante_id } = await c.req.json<{ participante_id: string }>();
  const p = await c.env.DB.prepare(`
    SELECT p.evento_id, p.nome, p.status, p.checkin_at, p.numero_ingresso, t.nome as tipo_nome
    FROM ximboca_participantes p
    LEFT JOIN ximboca_ingresso_tipos t ON t.id = p.tipo_ingresso_id
    WHERE p.id = ?
  `).bind(participante_id).first<{ evento_id: string; nome: string; status: string; checkin_at: string | null; numero_ingresso: number | null; tipo_nome: string | null }>();

  if (!p || p.evento_id !== eventoId) {
    await recordAttempt(c, 'ximboca_checkin_fail', rlKey);
    return c.json({ estado: 'NAO_ENCONTRADO' });
  }
  if (p.status !== 'pago') return c.json({ estado: 'NAO_PAGO', nome: p.nome, numero_ingresso: p.numero_ingresso, tipo_nome: p.tipo_nome });
  if (p.checkin_at) return c.json({ estado: 'JA_ENTROU', nome: p.nome, numero_ingresso: p.numero_ingresso, tipo_nome: p.tipo_nome, checkin_at: p.checkin_at });

  await c.env.DB.prepare(
    "UPDATE ximboca_participantes SET checkin_at = datetime('now'), checkin_por = ? WHERE id = ?"
  ).bind(trigrama, participante_id).run();

  return c.json({ estado: 'OK', nome: p.nome, numero_ingresso: p.numero_ingresso, tipo_nome: p.tipo_nome });
});

// ============ ROTAS ADMIN (daqui em diante) ============
ximboca.use('*', authMiddleware);

// Dashboard stats (across all events)
ximboca.get('/stats', async (c) => {
  const [totalEventos, totalArrecadado, totalGasto, eventosAbertos] = await Promise.all([
    c.env.DB.prepare("SELECT COUNT(*) as v FROM ximboca_eventos").first<{ v: number }>(),
    c.env.DB.prepare("SELECT COALESCE(SUM(COALESCE(p.valor_individual, e.valor_por_pessoa)), 0) as v FROM ximboca_participantes p JOIN ximboca_eventos e ON e.id = p.evento_id WHERE p.status = 'pago'").first<{ v: number }>(),
    c.env.DB.prepare("SELECT COALESCE(SUM(valor), 0) as v FROM ximboca_despesas").first<{ v: number }>(),
    c.env.DB.prepare("SELECT COUNT(*) as v FROM ximboca_eventos WHERE status = 'aberto'").first<{ v: number }>(),
  ]);

  return c.json({
    total_eventos: totalEventos?.v ?? 0,
    total_arrecadado: totalArrecadado?.v ?? 0,
    total_gasto: totalGasto?.v ?? 0,
    saldo: (totalArrecadado?.v ?? 0) - (totalGasto?.v ?? 0),
    eventos_abertos: eventosAbertos?.v ?? 0,
  });
});

// List all events with summary
ximboca.get('/eventos', async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT e.*,
      (SELECT COUNT(*) FROM ximboca_participantes p WHERE p.evento_id = e.id) as total_participantes,
      (SELECT COUNT(*) FROM ximboca_participantes p WHERE p.evento_id = e.id AND p.status = 'pago') as total_pagos,
      (SELECT COALESCE(SUM(COALESCE(p.valor_individual, e.valor_por_pessoa)), 0) FROM ximboca_participantes p WHERE p.evento_id = e.id AND p.status = 'pago') as total_arrecadado,
      (SELECT COALESCE(SUM(d.valor), 0) FROM ximboca_despesas d WHERE d.evento_id = e.id) as total_despesas
    FROM ximboca_eventos e
    ORDER BY e.data DESC
  `).all();
  return c.json(results);
});

// Create event
ximboca.post('/eventos', async (c) => {
  const { nome, data, valor_por_pessoa, descricao, valor_cerveja, valor_refri, pix_chave, pix_tipo, pix_nome, pix_whatsapp, inscricao_ate } = await c.req.json();
  if (!nome || !data) return c.json({ error: 'Nome e data obrigatórios' }, 400);

  const { results } = await c.env.DB.prepare(
    'INSERT INTO ximboca_eventos (nome, data, valor_por_pessoa, descricao, valor_cerveja, valor_refri, pix_chave, pix_tipo, pix_nome, pix_whatsapp, inscricao_ate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *'
  ).bind(
    nome, data, valor_por_pessoa ?? 0, descricao || '',
    valor_cerveja ?? null, valor_refri ?? null,
    pix_chave || null, pix_tipo || null, pix_nome || null, pix_whatsapp || null,
    inscricao_ate || null
  ).all();

  return c.json(results[0], 201);
});

// Get single event with participants and expenses
ximboca.get('/eventos/:id', async (c) => {
  const id = c.req.param('id');
  const evento = await c.env.DB.prepare('SELECT * FROM ximboca_eventos WHERE id = ?').bind(id).first();
  if (!evento) return c.json({ error: 'Evento não encontrado' }, 404);

  const { results: participantes } = await c.env.DB.prepare(
    'SELECT * FROM ximboca_participantes WHERE evento_id = ? ORDER BY nome ASC'
  ).bind(id).all();

  const { results: despesas } = await c.env.DB.prepare(
    'SELECT * FROM ximboca_despesas WHERE evento_id = ? ORDER BY created_at DESC'
  ).bind(id).all();

  const { results: tipos } = await c.env.DB.prepare(
    'SELECT * FROM ximboca_ingresso_tipos WHERE evento_id = ? ORDER BY ordem ASC, nome ASC'
  ).bind(id).all();

  const { results: tarefas } = await c.env.DB.prepare(
    'SELECT * FROM ximboca_tarefas WHERE evento_id = ? ORDER BY feito ASC, ordem ASC, created_at ASC'
  ).bind(id).all();

  const { results: cautelas } = await c.env.DB.prepare(
    'SELECT * FROM ximboca_cautelas WHERE evento_id = ? ORDER BY created_at ASC'
  ).bind(id).all();

  return c.json({ evento, participantes, despesas, tipos, tarefas, cautelas });
});

// Update event
ximboca.put('/eventos/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const fields: string[] = [];
  const values: unknown[] = [];

  if ('nome' in body) { fields.push('nome = ?'); values.push(body.nome); }
  if ('data' in body) { fields.push('data = ?'); values.push(body.data); }
  if ('valor_por_pessoa' in body) { fields.push('valor_por_pessoa = ?'); values.push(body.valor_por_pessoa); }
  if ('descricao' in body) { fields.push('descricao = ?'); values.push(body.descricao); }
  if ('status' in body) { fields.push('status = ?'); values.push(body.status); }
  if ('valor_cerveja' in body) { fields.push('valor_cerveja = ?'); values.push(body.valor_cerveja ?? null); }
  if ('inscricao_ate' in body) { fields.push('inscricao_ate = ?'); values.push(body.inscricao_ate || null); }
  if ('valor_refri' in body) { fields.push('valor_refri = ?'); values.push(body.valor_refri ?? null); }
  if ('pix_chave' in body) { fields.push('pix_chave = ?'); values.push(body.pix_chave || null); }
  if ('pix_tipo' in body) { fields.push('pix_tipo = ?'); values.push(body.pix_tipo || null); }
  if ('pix_nome' in body) { fields.push('pix_nome = ?'); values.push(body.pix_nome || null); }
  if ('pix_whatsapp' in body) { fields.push('pix_whatsapp = ?'); values.push(body.pix_whatsapp || null); }
  if ('imagem_url' in body) { fields.push('imagem_url = ?'); values.push(body.imagem_url || null); }

  if (!fields.length) return c.json({ error: 'Nada para atualizar' }, 400);
  values.push(id);

  const { results } = await c.env.DB.prepare(
    `UPDATE ximboca_eventos SET ${fields.join(', ')} WHERE id = ? RETURNING *`
  ).bind(...values).all();

  if (!results.length) return c.json({ error: 'Evento não encontrado' }, 404);
  return c.json(results[0]);
});

// Delete event
ximboca.delete('/eventos/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM ximboca_participantes WHERE evento_id = ?').bind(id).run();
  await c.env.DB.prepare('DELETE FROM ximboca_despesas WHERE evento_id = ?').bind(id).run();
  const result = await c.env.DB.prepare('DELETE FROM ximboca_eventos WHERE id = ?').bind(id).run();
  if (!result.meta.changes) return c.json({ error: 'Evento não encontrado' }, 404);
  return c.json({ ok: true });
});

// Consumir item do estoque em um evento (debita estoque + lanca despesa zerada como consumo)
ximboca.post('/eventos/:id/consumir-estoque', async (c) => {
  const evento_id = c.req.param('id');
  const { estoque_id, quantidade } = await c.req.json<{ estoque_id: string; quantidade: number }>();
  if (!estoque_id || !quantidade || quantidade <= 0) return c.json({ error: 'estoque_id e quantidade > 0 obrigatorios' }, 400);

  const item = await c.env.DB.prepare('SELECT * FROM ximboca_estoque WHERE id = ?').bind(estoque_id).first<{ id: string; nome: string; quantidade: number; unidade: string }>();
  if (!item) return c.json({ error: 'Item de estoque nao encontrado' }, 404);
  if (item.quantidade < quantidade) return c.json({ error: `Estoque insuficiente. Disponivel: ${item.quantidade} ${item.unidade}` }, 400);

  // Debita estoque
  await c.env.DB.prepare('UPDATE ximboca_estoque SET quantidade = quantidade - ? WHERE id = ?').bind(quantidade, estoque_id).run();

  // Lanca despesa com valor 0 (custo ja foi pago ao adquirir o estoque)
  const { results } = await c.env.DB.prepare(
    `INSERT INTO ximboca_despesas (evento_id, descricao, valor, categoria, quantidade, unidade)
     VALUES (?, ?, 0, 'estoque', ?, ?) RETURNING *`
  ).bind(evento_id, `[Estoque] ${item.nome}`, quantidade, item.unidade).all();

  return c.json(results[0], 201);
});

// Add participant
ximboca.post('/eventos/:id/participantes', async (c) => {
  const evento_id = c.req.param('id');
  const { nome, whatsapp, valor_individual, categoria_consumo } = await c.req.json();
  if (!nome) return c.json({ error: 'Nome obrigatório' }, 400);

  const { results } = await c.env.DB.prepare(
    'INSERT INTO ximboca_participantes (evento_id, nome, whatsapp, valor_individual, categoria_consumo) VALUES (?, ?, ?, ?, ?) RETURNING *'
  ).bind(evento_id, nome.trim().toUpperCase(), whatsapp || null, valor_individual || null, categoria_consumo || 'padrao').all();

  return c.json(results[0], 201);
});

// Mark participant as paid
ximboca.put('/participantes/:id/pagar', async (c) => {
  const id = c.req.param('id');
  const { results } = await c.env.DB.prepare(
    "UPDATE ximboca_participantes SET status = 'pago', paid_at = datetime('now') WHERE id = ? RETURNING *"
  ).bind(id).all();
  if (!results.length) return c.json({ error: 'Participante não encontrado' }, 404);
  const pago = results[0];

  // NOTIFICAÇÃO AUTOMÁTICA
  try {
    const evento = await c.env.DB.prepare("SELECT nome FROM ximboca_eventos WHERE id = ?").bind(pago.evento_id).first<{ nome: string }>();
    if (evento) {
      await c.env.DB.prepare(
        "INSERT INTO notificacoes (trigrama, titulo, mensagem) VALUES (?, 'XIMBOCA CONFIRMADA', ?)"
      ).bind(
        pago.nome, 
        `Seu pagamento para o evento "${evento.nome}" foi confirmado. Bom churrasco!`
      ).run();
    }
  } catch (err) {
    console.error('Erro ao enviar notificação de ximboca:', err);
  }

  return c.json(pago);
});

// Remove participant
ximboca.delete('/participantes/:id', async (c) => {
  const id = c.req.param('id');
  const result = await c.env.DB.prepare('DELETE FROM ximboca_participantes WHERE id = ?').bind(id).run();
  if (!result.meta.changes) return c.json({ error: 'Participante não encontrado' }, 404);
  return c.json({ ok: true });
});

// Add expense
ximboca.post('/eventos/:id/despesas', async (c) => {
  const evento_id = c.req.param('id');
  const { descricao, valor, categoria, quantidade, unidade } = await c.req.json();
  if (!descricao || valor == null) return c.json({ error: 'Descrição e valor obrigatórios' }, 400);

  const { results } = await c.env.DB.prepare(
    'INSERT INTO ximboca_despesas (evento_id, descricao, valor, categoria, quantidade, unidade) VALUES (?, ?, ?, ?, ?, ?) RETURNING *'
  ).bind(evento_id, descricao, valor, categoria || 'geral', quantidade || null, unidade || null).all();

  return c.json(results[0], 201);
});

// Remove expense
ximboca.delete('/despesas/:id', async (c) => {
  const id = c.req.param('id');
  const result = await c.env.DB.prepare('DELETE FROM ximboca_despesas WHERE id = ?').bind(id).run();
  if (!result.meta.changes) return c.json({ error: 'Despesa não encontrada' }, 404);
  return c.json({ ok: true });
});

// Estoque CRUD
ximboca.get('/estoque', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM ximboca_estoque ORDER BY nome ASC'
  ).all();
  return c.json(results);
});

ximboca.post('/estoque', async (c) => {
  const { nome, quantidade, unidade, origem_evento } = await c.req.json();
  if (!nome) return c.json({ error: 'Nome obrigatório' }, 400);
  const { results } = await c.env.DB.prepare(
    'INSERT INTO ximboca_estoque (nome, quantidade, unidade, origem_evento) VALUES (?, ?, ?, ?) RETURNING *'
  ).bind(nome, quantidade ?? 0, unidade || 'un', origem_evento || null).all();
  return c.json(results[0], 201);
});

ximboca.put('/estoque/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const fields: string[] = [];
  const values: unknown[] = [];
  if ('nome' in body) { fields.push('nome = ?'); values.push(body.nome); }
  if ('quantidade' in body) { fields.push('quantidade = ?'); values.push(body.quantidade); }
  if ('unidade' in body) { fields.push('unidade = ?'); values.push(body.unidade); }
  if ('origem_evento' in body) { fields.push('origem_evento = ?'); values.push(body.origem_evento); }
  if (!fields.length) return c.json({ error: 'Nada para atualizar' }, 400);
  values.push(id);
  const { results } = await c.env.DB.prepare(
    `UPDATE ximboca_estoque SET ${fields.join(', ')} WHERE id = ? RETURNING *`
  ).bind(...values).all();
  if (!results.length) return c.json({ error: 'Item não encontrado' }, 404);
  return c.json(results[0]);
});

ximboca.delete('/estoque/:id', async (c) => {
  const id = c.req.param('id');
  const result = await c.env.DB.prepare('DELETE FROM ximboca_estoque WHERE id = ?').bind(id).run();
  if (!result.meta.changes) return c.json({ error: 'Item não encontrado' }, 404);
  return c.json({ ok: true });
});

// ============ TIPOS DE INGRESSO (admin) ============
ximboca.get('/eventos/:id/tipos', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM ximboca_ingresso_tipos WHERE evento_id = ? ORDER BY ordem ASC, nome ASC'
  ).bind(c.req.param('id')).all();
  return c.json(results);
});

ximboca.post('/eventos/:id/tipos', async (c) => {
  const evento_id = c.req.param('id');
  const { nome, valor, ordem } = await c.req.json<{ nome: string; valor: number; ordem?: number }>();
  if (!nome || valor == null) return c.json({ error: 'Nome e valor obrigatórios' }, 400);
  const { results } = await c.env.DB.prepare(
    'INSERT INTO ximboca_ingresso_tipos (evento_id, nome, valor, ordem) VALUES (?, ?, ?, ?) RETURNING *'
  ).bind(evento_id, nome.trim(), valor, ordem ?? 0).all();
  return c.json(results[0], 201);
});

ximboca.put('/tipos/:tipoId', async (c) => {
  const id = c.req.param('tipoId');
  const body = await c.req.json();
  const fields: string[] = [];
  const values: unknown[] = [];
  if ('nome' in body) { fields.push('nome = ?'); values.push(body.nome); }
  if ('valor' in body) { fields.push('valor = ?'); values.push(body.valor); }
  if ('ordem' in body) { fields.push('ordem = ?'); values.push(body.ordem); }
  if (!fields.length) return c.json({ error: 'Nada para atualizar' }, 400);
  values.push(id);
  const { results } = await c.env.DB.prepare(
    `UPDATE ximboca_ingresso_tipos SET ${fields.join(', ')} WHERE id = ? RETURNING *`
  ).bind(...values).all();
  if (!results.length) return c.json({ error: 'Tipo não encontrado' }, 404);
  return c.json(results[0]);
});

ximboca.delete('/tipos/:tipoId', async (c) => {
  const id = c.req.param('tipoId');
  const emUso = await c.env.DB.prepare(
    'SELECT id FROM ximboca_participantes WHERE tipo_ingresso_id = ? LIMIT 1'
  ).bind(id).first();
  if (emUso) return c.json({ error: 'Tipo já usado por um participante — não pode ser removido' }, 400);
  const result = await c.env.DB.prepare('DELETE FROM ximboca_ingresso_tipos WHERE id = ?').bind(id).run();
  if (!result.meta.changes) return c.json({ error: 'Tipo não encontrado' }, 404);
  return c.json({ ok: true });
});

// ============ CHECKLIST / TAREFAS (admin) ============
ximboca.post('/eventos/:id/tarefas', async (c) => {
  const evento_id = c.req.param('id');
  const { titulo, responsavel } = await c.req.json<{ titulo: string; responsavel?: string }>();
  if (!titulo) return c.json({ error: 'Título obrigatório' }, 400);
  const { results } = await c.env.DB.prepare(
    'INSERT INTO ximboca_tarefas (evento_id, titulo, responsavel) VALUES (?, ?, ?) RETURNING *'
  ).bind(evento_id, titulo.trim(), responsavel?.trim() || null).all();
  return c.json(results[0], 201);
});

ximboca.put('/tarefas/:tarefaId', async (c) => {
  const id = c.req.param('tarefaId');
  const body = await c.req.json();
  const fields: string[] = [];
  const values: unknown[] = [];
  if ('titulo' in body) { fields.push('titulo = ?'); values.push(body.titulo); }
  if ('responsavel' in body) { fields.push('responsavel = ?'); values.push(body.responsavel || null); }
  if ('feito' in body) { fields.push('feito = ?'); values.push(body.feito ? 1 : 0); }
  if (!fields.length) return c.json({ error: 'Nada para atualizar' }, 400);
  values.push(id);
  const { results } = await c.env.DB.prepare(
    `UPDATE ximboca_tarefas SET ${fields.join(', ')} WHERE id = ? RETURNING *`
  ).bind(...values).all();
  if (!results.length) return c.json({ error: 'Tarefa não encontrada' }, 404);
  return c.json(results[0]);
});

ximboca.delete('/tarefas/:tarefaId', async (c) => {
  const result = await c.env.DB.prepare('DELETE FROM ximboca_tarefas WHERE id = ?').bind(c.req.param('tarefaId')).run();
  if (!result.meta.changes) return c.json({ error: 'Tarefa não encontrada' }, 404);
  return c.json({ ok: true });
});

// ============ CAUTELA DE MATERIAL (admin) ============
ximboca.post('/eventos/:id/cautelas', async (c) => {
  const evento_id = c.req.param('id');
  const { item, quantidade, unidade, origem, responsavel, observacao } = await c.req.json();
  if (!item) return c.json({ error: 'Item obrigatório' }, 400);
  const { results } = await c.env.DB.prepare(
    'INSERT INTO ximboca_cautelas (evento_id, item, quantidade, unidade, origem, responsavel, observacao) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *'
  ).bind(evento_id, item.trim(), quantidade ?? 0, unidade || 'un', origem?.trim() || null, responsavel?.trim() || null, observacao?.trim() || null).all();
  return c.json(results[0], 201);
});

ximboca.put('/cautelas/:cautelaId', async (c) => {
  const id = c.req.param('cautelaId');
  const body = await c.req.json();
  const fields: string[] = [];
  const values: unknown[] = [];
  if ('item' in body) { fields.push('item = ?'); values.push(body.item); }
  if ('quantidade' in body) { fields.push('quantidade = ?'); values.push(body.quantidade ?? 0); }
  if ('unidade' in body) { fields.push('unidade = ?'); values.push(body.unidade || 'un'); }
  if ('origem' in body) { fields.push('origem = ?'); values.push(body.origem || null); }
  if ('responsavel' in body) { fields.push('responsavel = ?'); values.push(body.responsavel || null); }
  if ('qtd_devolvida' in body) { fields.push('qtd_devolvida = ?'); values.push(body.qtd_devolvida ?? 0); }
  if ('observacao' in body) { fields.push('observacao = ?'); values.push(body.observacao || null); }
  if (!fields.length) return c.json({ error: 'Nada para atualizar' }, 400);
  values.push(id);
  const { results } = await c.env.DB.prepare(
    `UPDATE ximboca_cautelas SET ${fields.join(', ')} WHERE id = ? RETURNING *`
  ).bind(...values).all();
  if (!results.length) return c.json({ error: 'Cautela não encontrada' }, 404);
  return c.json(results[0]);
});

ximboca.delete('/cautelas/:cautelaId', async (c) => {
  const result = await c.env.DB.prepare('DELETE FROM ximboca_cautelas WHERE id = ?').bind(c.req.param('cautelaId')).run();
  if (!result.meta.changes) return c.json({ error: 'Cautela não encontrada' }, 404);
  return c.json({ ok: true });
});

// Upload da capa do evento (R2)
ximboca.post('/eventos/:id/imagem', async (c) => {
  const id = c.req.param('id');
  const formData = await c.req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return c.json({ error: 'Nenhum arquivo enviado' }, 400);
  if (file.size > 5 * 1024 * 1024) return c.json({ error: 'Arquivo deve ter no máximo 5MB' }, 400);
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  if (!['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) {
    return c.json({ error: 'Formato não suportado. Use: jpg, png, webp, gif' }, 400);
  }
  const key = `ximboca/${crypto.randomUUID()}.${ext}`;
  await c.env.IMAGES.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
  const url = `/api/images/${key}`;
  await c.env.DB.prepare('UPDATE ximboca_eventos SET imagem_url = ? WHERE id = ?').bind(url, id).run();
  return c.json({ url });
});

// Contadores de entrada
ximboca.get('/eventos/:id/checkin-stats', async (c) => {
  const id = c.req.param('id');
  const row = await c.env.DB.prepare(`
    SELECT
      SUM(CASE WHEN status = 'pago' THEN 1 ELSE 0 END) as total_pagos,
      SUM(CASE WHEN status = 'pago' AND checkin_at IS NOT NULL THEN 1 ELSE 0 END) as entraram
    FROM ximboca_participantes WHERE evento_id = ?
  `).bind(id).first<{ total_pagos: number | null; entraram: number | null }>();
  const total_pagos = row?.total_pagos ?? 0;
  const entraram = row?.entraram ?? 0;
  return c.json({ total_pagos, entraram, faltam: total_pagos - entraram });
});

export default ximboca;
