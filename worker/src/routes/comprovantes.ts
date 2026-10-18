import { Hono, Context } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { userAuthMiddleware } from '../middleware/userAuth';
import { audit } from '../lib/audit';
import { pagarPedidoLoja, pagarParcelaLoja } from '../lib/loja';
import { filtroComprovantesEscopo } from '../lib/escopo';
import { validarArquivo, TIPOS_IMAGEM } from '../lib/arquivo';
import { checkRateLimit, recordAttempt } from '../lib/rateLimit';
import { verify } from '../lib/jwt';
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

// Comprovante visível ao admin? Sem escopo sempre; com escopo só os do café da sala dele
async function comprovanteNoEscopo(c: Context<AppType>, id: string | undefined): Promise<boolean> {
  const esc = filtroComprovantesEscopo(c);
  if (!esc) return true;
  if (!id) return false;
  const row = await c.env.DB.prepare(`SELECT id FROM comprovantes WHERE id = ? AND ${esc.sql}`).bind(id, ...esc.params).first();
  return !!row;
}

type RowComprovante = { id: string; imagem_key?: string | null; [k: string]: unknown };

function urlImagemComprovante(id: string): string {
  return `/api/comprovantes/${id}/imagem`;
}

// A imagem do comprovante só é servida pela rota autenticada (linhas antigas guardam a URL pública
// /api/images/comprovantes/..., que agora responde 404). imagem_pdf diz ao app como exibir.
function comImagemProtegida(row: RowComprovante) {
  const { imagem_key, ...resto } = row;
  return {
    ...resto,
    imagem_url: urlImagemComprovante(row.id),
    imagem_pdf: typeof imagem_key === 'string' && imagem_key.toLowerCase().endsWith('.pdf'),
  };
}

// Admin OU usuário: escolhe o middleware pelo tipo do token (o middleware revalida tudo no banco)
async function adminOuUsuario(c: Context<AppType>, next: () => Promise<void>) {
  const header = c.req.header('Authorization');
  const payload = header?.startsWith('Bearer ') ? await verify(header.slice(7), c.env.JWT_SECRET) : null;
  if (payload?.tipo === 'usuario') return userAuthMiddleware(c, next);
  return authMiddleware(c, next);
}

// ADMIN (no escopo) ou USUÁRIO dono: arquivo do comprovante. Nunca em cache compartilhado.
comprovantes.get('/:id/imagem', adminOuUsuario, async (c) => {
  const id = c.req.param('id');
  const comp = await c.env.DB.prepare('SELECT id, usuario_id, imagem_key FROM comprovantes WHERE id = ?')
    .bind(id).first<{ id: string; usuario_id: string | null; imagem_key: string }>();
  const naoEncontrado = () => c.json({ error: 'Comprovante não encontrado' }, 404);
  if (!comp) return naoEncontrado();

  if (c.get('adminId')) {
    if (!(await comprovanteNoEscopo(c, id))) return naoEncontrado();
  } else if (comp.usuario_id !== String(c.get('userId'))) {
    return naoEncontrado();
  }

  const object = await c.env.IMAGES.get(comp.imagem_key);
  if (!object) return naoEncontrado();
  const headers = new Headers();
  headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');
  headers.set('Cache-Control', 'private, no-store');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Content-Disposition', 'inline');
  return new Response(object.body, { headers });
});

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

  // Tipo e extensão pelo conteúdo (magic bytes), nunca pelo nome/Content-Type do cliente
  const v = await validarArquivo(file, [...TIPOS_IMAGEM, 'pdf']);
  if (!v.ok) return c.json({ error: v.erro }, 400);

  // Limite de envios por usuário (evita encher o R2/fila de aprovação)
  const rlKey = `usuario:${userId}`;
  const rl = await checkRateLimit(c, 'comprovante_envio', rlKey, 20, 24 * 60);
  if (!rl.ok) return c.json({ error: 'Limite diário de envio de comprovantes atingido. Tente amanhã.' }, 429);

  const val = await validarDono(c, origem, referencia_id, trigrama);
  if (!val.ok) return c.json({ error: val.error }, 403);

  // Bloqueia envio duplicado enquanto há um aguardando
  const pendente = await c.env.DB.prepare(
    "SELECT id FROM comprovantes WHERE origem = ? AND referencia_id = ? AND status = 'aguardando'"
  ).bind(origem, referencia_id).first();
  if (pendente) return c.json({ error: 'Já existe um comprovante aguardando aprovação' }, 409);

  await recordAttempt(c, 'comprovante_envio', rlKey);
  // id e nome do arquivo gerados no servidor; a imagem só sai pela rota autenticada
  const id = crypto.randomUUID().replace(/-/g, '');
  const key = `comprovantes/${crypto.randomUUID()}.${v.arquivo.ext}`;
  await c.env.IMAGES.put(key, v.arquivo.bytes, { httpMetadata: { contentType: v.arquivo.contentType } });
  const url = urlImagemComprovante(id);

  const { results } = await c.env.DB.prepare(
    `INSERT INTO comprovantes (id, origem, referencia_id, cliente_id, usuario_id, trigrama, valor, imagem_url, imagem_key, observacao)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`
  ).bind(id, origem, referencia_id, val.cliente_id || null, String(userId), trigrama, val.valor || null, url, key, observacao).all();

  return c.json(comImagemProtegida(results[0] as RowComprovante), 201);
});

// USER: lista meus comprovantes
comprovantes.get('/me', userAuthMiddleware, async (c) => {
  const trigrama = c.get('userTrigrama');
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM comprovantes WHERE trigrama = ? COLLATE NOCASE ORDER BY created_at DESC LIMIT 50'
  ).bind(trigrama).all<RowComprovante>();
  return c.json(results.map(comImagemProtegida));
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
  // Escopo: só comprovantes do café da sala do escopo
  const esc = filtroComprovantesEscopo(c);
  if (esc) { conds.push(esc.sql); params.push(...esc.params); }

  const where = conds.join(' AND ');
  const totalRow = await c.env.DB.prepare(`SELECT COUNT(*) as total FROM comprovantes WHERE ${where}`).bind(...params).first<{ total: number }>();

  const { results } = await c.env.DB.prepare(
    `SELECT * FROM comprovantes WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).bind(...params, limit, offset).all<RowComprovante>();

  return c.json({ items: results.map(comImagemProtegida), total: totalRow?.total || 0, limit, offset });
});

// ADMIN: aprovar → marca o item de origem como pago
comprovantes.put('/:id/aprovar', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const reviewer = c.get('adminEmail');

  const comp = await c.env.DB.prepare(
    "SELECT origem, referencia_id, status FROM comprovantes WHERE id = ?"
  ).bind(id).first<{ origem: Origem; referencia_id: string; status: string }>();
  if (!comp || !(await comprovanteNoEscopo(c, id))) return c.json({ error: 'Comprovante não encontrado' }, 404);
  if (comp.status !== 'aguardando') return c.json({ error: 'Comprovante já foi processado' }, 400);

  // Marca o item de origem como pago
  if (comp.origem === 'cantina') {
    await c.env.DB.prepare("UPDATE pedidos SET status = 'pago', paid_at = datetime('now') WHERE id = ? AND status != 'pago'").bind(comp.referencia_id).run();
  } else if (comp.origem === 'loja') {
    // Pedido inteiro pago => quita as parcelas pendentes
    await pagarPedidoLoja(c.env.DB, comp.referencia_id);
  } else if (comp.origem === 'loja_parcela') {
    // Última parcela paga => pedido pago
    await pagarParcelaLoja(c.env.DB, comp.referencia_id);
  } else if (comp.origem === 'cafe') {
    await c.env.DB.prepare("UPDATE cafe_pagamentos SET status = 'pago', paid_at = datetime('now') WHERE id = ? AND status != 'pago'").bind(comp.referencia_id).run();
  } else if (comp.origem === 'ximboca') {
    await c.env.DB.prepare("UPDATE ximboca_participantes SET status = 'pago', paid_at = datetime('now') WHERE id = ? AND status != 'pago'").bind(comp.referencia_id).run();
  }

  const { results } = await c.env.DB.prepare(
    "UPDATE comprovantes SET status = 'aprovado', reviewed_by = ?, reviewed_at = datetime('now') WHERE id = ? RETURNING *"
  ).bind(reviewer, id).all<any>();
  
  const aprovado = results[0];
  if (!aprovado) return c.json({ error: 'Comprovante não encontrado' }, 404);
  await audit(c, 'aprovar_comprovante', 'comprovantes', id, null, { origem: comp.origem, referencia_id: comp.referencia_id });

  // NOTIFICAÇÃO AUTOMÁTICA
  try {
    await c.env.DB.prepare(
      "INSERT INTO notificacoes (trigrama, titulo, mensagem) VALUES (?, 'PAGAMENTO APROVADO', ?)"
    ).bind(
      aprovado.trigrama, 
      `Missão Cumprida! Seu pagamento de R$ ${(aprovado.valor ?? 0).toFixed(2)} (${comp.origem.toUpperCase()}) foi confirmado. Disciplina e pontualidade são marcas do nosso esquadrão.`
    ).run();
  } catch (err) {
    console.error('Erro ao enviar notificação de aprovação:', err);
  }

  return c.json(comImagemProtegida(aprovado));
});

// ADMIN: rejeitar
comprovantes.put('/:id/rejeitar', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const reviewer = c.get('adminEmail');
  const { motivo } = await c.req.json<{ motivo?: string }>();
  if (!(await comprovanteNoEscopo(c, id))) return c.json({ error: 'Comprovante não encontrado ou já processado' }, 404);

  const { results } = await c.env.DB.prepare(
    "UPDATE comprovantes SET status = 'rejeitado', motivo_rejeicao = ?, reviewed_by = ?, reviewed_at = datetime('now') WHERE id = ? AND status = 'aguardando' RETURNING *"
  ).bind(motivo || 'Sem motivo informado', reviewer, id).all<any>();
  
  if (!results.length) return c.json({ error: 'Comprovante não encontrado ou já processado' }, 404);
  const rejeitado = results[0];
  await audit(c, 'rejeitar_comprovante', 'comprovantes', id, null, { motivo });

  // NOTIFICAÇÃO AUTOMÁTICA
  try {
    await c.env.DB.prepare(
      "INSERT INTO notificacoes (trigrama, titulo, mensagem) VALUES (?, 'PAGAMENTO REJEITADO', ?)"
    ).bind(
      rejeitado.trigrama, 
      `Atenção no Radar: Seu comprovante de R$ ${(rejeitado.valor ?? 0).toFixed(2)} não pôde ser validado. Motivo: ${motivo || 'Não informado'}. Por favor, verifique e reenvie para manter sua ficha limpa!`
    ).run();
  } catch (err) {
    console.error('Erro ao enviar notificação de rejeição:', err);
  }

  return c.json(comImagemProtegida(rejeitado));
});

// ADMIN: contador de pendentes (para badge)
comprovantes.get('/pendentes/count', authMiddleware, async (c) => {
  const esc = filtroComprovantesEscopo(c);
  const row = esc
    ? await c.env.DB.prepare(`SELECT COUNT(*) as total FROM comprovantes WHERE status = 'aguardando' AND ${esc.sql}`).bind(...esc.params).first<{ total: number }>()
    : await c.env.DB.prepare("SELECT COUNT(*) as total FROM comprovantes WHERE status = 'aguardando'").first<{ total: number }>();
  return c.json({ total: row?.total || 0 });
});

export default comprovantes;
