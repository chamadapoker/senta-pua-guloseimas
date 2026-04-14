import { Hono, Context } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { userAuthMiddleware } from '../middleware/userAuth';
import { audit } from '../lib/audit';
import type { AppType } from '../index';

const comprovantes = new Hono<AppType>();

type Origem = 'cantina' | 'loja' | 'loja_parcela' | 'cafe' | 'ximboca';

// Valida que o item (pedido/parcela/pagamento/participante) pertence ao user logado
async function validarDono(c: Context<AppType>, origem: Origem, refId: string, trigrama: string): Promise<{ ok: boolean; valor?: number; cliente_id?: string | null; error?: string }> {
  if (origem === 'cantina') {
    const p = await c.env.DB.prepare(
      `SELECT p.id, p.total as valor, p.status, p.cliente_id
       FROM pedidos p JOIN clientes cl ON cl.id = p.cliente_id
       WHERE p.id = ? AND cl.nome_guerra = ? COLLATE NOCASE`
    ).bind(refId, trigrama).first<{ valor: number; status: string; cliente_id: string }>();
    if (!p) return { ok: false, error: 'Pedido não encontrado ou não pertence a você' };
    if (p.status === 'pago') return { ok: false, error: 'Este pedido já está pago' };
    return { ok: true, valor: p.valor, cliente_id: p.cliente_id };
  }
  if (origem === 'loja') {
    const p = await c.env.DB.prepare(
      `SELECT p.id, p.total as valor, p.status, p.cliente_id
       FROM loja_pedidos p JOIN clientes cl ON cl.id = p.cliente_id
       WHERE p.id = ? AND cl.nome_guerra = ? COLLATE NOCASE`
    ).bind(refId, trigrama).first<{ valor: number; status: string; cliente_id: string }>();
    if (!p) return { ok: false, error: 'Pedido da loja não encontrado' };
    if (p.status === 'pago') return { ok: false, error: 'Este pedido já está pago' };
    return { ok: true, valor: p.valor, cliente_id: p.cliente_id };
  }
  if (origem === 'loja_parcela') {
    const p = await c.env.DB.prepare(
      `SELECT lp.id, lp.valor, lp.status, ped.cliente_id
       FROM loja_parcelas lp
       JOIN loja_pedidos ped ON ped.id = lp.pedido_id
       JOIN clientes cl ON cl.id = ped.cliente_id
       WHERE lp.id = ? AND cl.nome_guerra = ? COLLATE NOCASE`
    ).bind(refId, trigrama).first<{ valor: number; status: string; cliente_id: string }>();
    if (!p) return { ok: false, error: 'Parcela não encontrada' };
    if (p.status === 'pago') return { ok: false, error: 'Esta parcela já está paga' };
    return { ok: true, valor: p.valor, cliente_id: p.cliente_id };
  }
  if (origem === 'cafe') {
    const p = await c.env.DB.prepare(
      `SELECT cp.id, cp.valor, cp.status, ca.cliente_id
       FROM cafe_pagamentos cp
       JOIN cafe_assinantes ca ON ca.id = cp.assinante_id
       JOIN clientes cl ON cl.id = ca.cliente_id
       WHERE cp.id = ? AND cl.nome_guerra = ? COLLATE NOCASE`
    ).bind(refId, trigrama).first<{ valor: number; status: string; cliente_id: string }>();
    if (!p) return { ok: false, error: 'Pagamento do café não encontrado' };
    if (p.status === 'pago') return { ok: false, error: 'Esta mensalidade já está paga' };
    return { ok: true, valor: p.valor, cliente_id: p.cliente_id };
  }
  if (origem === 'ximboca') {
    const p = await c.env.DB.prepare(
      `SELECT xp.id, COALESCE(xp.valor_individual, xe.valor_por_pessoa) as valor, xp.status
       FROM ximboca_participantes xp
       JOIN ximboca_eventos xe ON xe.id = xp.evento_id
       WHERE xp.id = ? AND xp.nome = ? COLLATE NOCASE`
    ).bind(refId, trigrama).first<{ valor: number; status: string }>();
    if (!p) return { ok: false, error: 'Participação não encontrada' };
    if (p.status === 'pago') return { ok: false, error: 'Esta participação já está paga' };
    return { ok: true, valor: p.valor, cliente_id: null };
  }
  return { ok: false, error: 'Origem inválida' };
}

// USER: envia comprovante
comprovantes.post('/', userAuthMiddleware, async (c) => {
  const trigrama = c.get('userTrigrama');
  const userId = c.get('userId');

  const formData = await c.req.formData();
  const origem = formData.get('origem') as Origem | null;
  const referencia_id = formData.get('referencia_id') as string | null;
  const observacao = (formData.get('observacao') as string | null) || '';
  const file = formData.get('file') as File | null;

  if (!origem || !referencia_id || !file) return c.json({ error: 'origem, referencia_id e file são obrigatórios' }, 400);
  if (!['cantina', 'loja', 'loja_parcela', 'cafe', 'ximboca'].includes(origem)) return c.json({ error: 'Origem inválida' }, 400);

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const allowed = ['jpg', 'jpeg', 'png', 'webp', 'pdf'];
  if (!allowed.includes(ext)) return c.json({ error: 'Formato inválido. Use JPG, PNG, WEBP ou PDF' }, 400);
  if (file.size > 5 * 1024 * 1024) return c.json({ error: 'Arquivo deve ter no máximo 5MB' }, 400);

  const val = await validarDono(c, origem, referencia_id, trigrama);
  if (!val.ok) return c.json({ error: val.error }, 403);

  // Bloqueia envio duplicado enquanto há um aguardando
  const pendente = await c.env.DB.prepare(
    "SELECT id FROM comprovantes WHERE origem = ? AND referencia_id = ? AND status = 'aguardando'"
  ).bind(origem, referencia_id).first();
  if (pendente) return c.json({ error: 'Já existe um comprovante aguardando aprovação' }, 409);

  const key = `comprovantes/${crypto.randomUUID()}.${ext}`;
  await c.env.IMAGES.put(key, file.stream(), { httpMetadata: { contentType: file.type || 'image/jpeg' } });
  const url = `/api/images/${key}`;

  const { results } = await c.env.DB.prepare(
    `INSERT INTO comprovantes (origem, referencia_id, cliente_id, usuario_id, trigrama, valor, imagem_url, imagem_key, observacao)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`
  ).bind(origem, referencia_id, val.cliente_id || null, String(userId), trigrama, val.valor || null, url, key, observacao).all();

  return c.json(results[0], 201);
});

// USER: lista meus comprovantes
comprovantes.get('/me', userAuthMiddleware, async (c) => {
  const trigrama = c.get('userTrigrama');
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM comprovantes WHERE trigrama = ? COLLATE NOCASE ORDER BY created_at DESC LIMIT 50'
  ).bind(trigrama).all();
  return c.json(results);
});

// USER: status do comprovante mais recente por item (para mostrar badge)
comprovantes.get('/me/status', userAuthMiddleware, async (c) => {
  const trigrama = c.get('userTrigrama');
  const { results } = await c.env.DB.prepare(
    `SELECT c.origem, c.referencia_id, c.status, c.motivo_rejeicao, c.created_at
     FROM comprovantes c
     INNER JOIN (
       SELECT origem, referencia_id, MAX(created_at) as max_created
       FROM comprovantes
       WHERE trigrama = ? COLLATE NOCASE
       GROUP BY origem, referencia_id
     ) latest ON c.origem = latest.origem AND c.referencia_id = latest.referencia_id AND c.created_at = latest.max_created
     WHERE c.trigrama = ? COLLATE NOCASE`
  ).bind(trigrama, trigrama).all<{ origem: string; referencia_id: string; status: string; motivo_rejeicao: string | null; created_at: string }>();
  return c.json(results);
});

// ADMIN: lista comprovantes (filtro por status + paginacao + busca)
comprovantes.get('/', authMiddleware, async (c) => {
  const status = c.req.query('status') || 'aguardando';
  const q = c.req.query('q');
  const origem = c.req.query('origem');
  const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 200);
  const offset = Math.max(parseInt(c.req.query('offset') || '0', 10), 0);

  const conds = ['status = ?'];
  const params: unknown[] = [status];
  if (origem) { conds.push('origem = ?'); params.push(origem); }
  if (q)      { conds.push('trigrama LIKE ? COLLATE NOCASE'); params.push(`%${q}%`); }

  const where = conds.join(' AND ');
  const totalRow = await c.env.DB.prepare(`SELECT COUNT(*) as total FROM comprovantes WHERE ${where}`).bind(...params).first<{ total: number }>();

  const { results } = await c.env.DB.prepare(
    `SELECT * FROM comprovantes WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).bind(...params, limit, offset).all();

  return c.json({ items: results, total: totalRow?.total || 0, limit, offset });
});

// ADMIN: aprovar → marca o item de origem como pago
comprovantes.put('/:id/aprovar', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const reviewer = c.get('adminEmail');

  const comp = await c.env.DB.prepare(
    "SELECT origem, referencia_id, status FROM comprovantes WHERE id = ?"
  ).bind(id).first<{ origem: Origem; referencia_id: string; status: string }>();
  if (!comp) return c.json({ error: 'Comprovante não encontrado' }, 404);
  if (comp.status !== 'aguardando') return c.json({ error: 'Comprovante já foi processado' }, 400);

  // Marca o item de origem como pago
  if (comp.origem === 'cantina') {
    await c.env.DB.prepare("UPDATE pedidos SET status = 'pago', paid_at = datetime('now') WHERE id = ? AND status != 'pago'").bind(comp.referencia_id).run();
  } else if (comp.origem === 'loja') {
    await c.env.DB.prepare("UPDATE loja_pedidos SET status = 'pago', paid_at = datetime('now') WHERE id = ? AND status != 'pago'").bind(comp.referencia_id).run();
  } else if (comp.origem === 'loja_parcela') {
    await c.env.DB.prepare("UPDATE loja_parcelas SET status = 'pago', paid_at = datetime('now') WHERE id = ? AND status != 'pago'").bind(comp.referencia_id).run();
  } else if (comp.origem === 'cafe') {
    await c.env.DB.prepare("UPDATE cafe_pagamentos SET status = 'pago', paid_at = datetime('now') WHERE id = ? AND status != 'pago'").bind(comp.referencia_id).run();
  } else if (comp.origem === 'ximboca') {
    await c.env.DB.prepare("UPDATE ximboca_participantes SET status = 'pago', paid_at = datetime('now') WHERE id = ? AND status != 'pago'").bind(comp.referencia_id).run();
  }

  const { results } = await c.env.DB.prepare(
    "UPDATE comprovantes SET status = 'aprovado', reviewed_by = ?, reviewed_at = datetime('now') WHERE id = ? RETURNING *"
  ).bind(reviewer, id).all();
  await audit(c, 'aprovar_comprovante', 'comprovantes', id, null, { origem: comp.origem, referencia_id: comp.referencia_id });
  return c.json(results[0]);
});

// ADMIN: rejeitar
comprovantes.put('/:id/rejeitar', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const reviewer = c.get('adminEmail');
  const { motivo } = await c.req.json<{ motivo?: string }>();

  const { results } = await c.env.DB.prepare(
    "UPDATE comprovantes SET status = 'rejeitado', motivo_rejeicao = ?, reviewed_by = ?, reviewed_at = datetime('now') WHERE id = ? AND status = 'aguardando' RETURNING *"
  ).bind(motivo || 'Sem motivo informado', reviewer, id).all();
  if (!results.length) return c.json({ error: 'Comprovante não encontrado ou já processado' }, 404);
  await audit(c, 'rejeitar_comprovante', 'comprovantes', id, null, { motivo });
  return c.json(results[0]);
});

// ADMIN: contador de pendentes (para badge)
comprovantes.get('/pendentes/count', authMiddleware, async (c) => {
  const row = await c.env.DB.prepare("SELECT COUNT(*) as total FROM comprovantes WHERE status = 'aguardando'").first<{ total: number }>();
  return c.json({ total: row?.total || 0 });
});

export default comprovantes;
