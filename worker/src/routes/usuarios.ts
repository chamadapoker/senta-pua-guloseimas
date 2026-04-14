import { Hono } from 'hono';
import { sign } from '../lib/jwt';
import { hashPassword, verifyPassword } from '../lib/password';
import { userAuthMiddleware } from '../middleware/userAuth';
import { authMiddleware } from '../middleware/auth';
import { isCategoriaValida, derivarSalaCafe, type Categoria } from '../lib/categoria';
import { visitanteBloqueado, calcularExpiracaoVisitante } from '../lib/visitante';
import type { AppType } from '../index';

const usuarios = new Hono<AppType>();

// Publico: cadastro
usuarios.post('/cadastro', async (c) => {
  const { email, senha, trigrama, saram, whatsapp, categoria, aceite_lgpd } = await c.req.json<{
    email: string; senha: string; trigrama: string; saram: string; whatsapp: string; categoria: string;
    aceite_lgpd?: boolean;
  }>();

  if (!email || !senha || !trigrama || !saram || !whatsapp || !categoria) {
    return c.json({ error: 'Todos os campos são obrigatórios' }, 400);
  }
  if (!aceite_lgpd) {
    return c.json({ error: 'Você precisa aceitar a Política de Privacidade para se cadastrar' }, 400);
  }
  if (!isCategoriaValida(categoria)) return c.json({ error: 'Categoria militar inválida' }, 400);
  if (senha.length < 6) return c.json({ error: 'Senha deve ter no mínimo 6 caracteres' }, 400);

  const trigramaClean = trigrama.trim().toUpperCase();
  if (!/^[A-ZÀ-ÚÖ]{3}$/.test(trigramaClean)) return c.json({ error: 'Trigrama deve ter exatamente 3 letras' }, 400);

  const saramClean = saram.trim();
  if (!/^\d+$/.test(saramClean)) return c.json({ error: 'SARAM deve conter apenas números' }, 400);

  const emailClean = email.trim().toLowerCase();

  const existEmail = await c.env.DB.prepare('SELECT id FROM usuarios WHERE email = ?').bind(emailClean).first();
  if (existEmail) return c.json({ error: 'Email já cadastrado' }, 409);

  const existTrigrama = await c.env.DB.prepare('SELECT id FROM usuarios WHERE trigrama = ?').bind(trigramaClean).first();
  if (existTrigrama) return c.json({ error: 'Trigrama já cadastrado' }, 409);

  const existSaram = await c.env.DB.prepare('SELECT id FROM usuarios WHERE saram = ?').bind(saramClean).first();
  if (existSaram) return c.json({ error: 'SARAM já cadastrado' }, 409);

  const senhaHash = await hashPassword(senha);
  const whatsappClean = whatsapp.trim();
  const salaCafe = derivarSalaCafe(categoria as Categoria);

  const { results } = await c.env.DB.prepare(
    `INSERT INTO usuarios (email, senha_hash, trigrama, saram, whatsapp, categoria, sala_cafe, aceitou_lgpd_em)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now')) RETURNING id`
  ).bind(emailClean, senhaHash, trigramaClean, saramClean, whatsappClean, categoria, salaCafe).all<{ id: number }>();

  const userId = results[0].id;

  const existCliente = await c.env.DB.prepare(
    'SELECT id FROM clientes WHERE nome_guerra = ? COLLATE NOCASE'
  ).bind(trigramaClean).first();

  if (!existCliente) {
    await c.env.DB.prepare('INSERT INTO clientes (nome_guerra, whatsapp) VALUES (?, ?)')
      .bind(trigramaClean, whatsappClean).run();
  } else {
    await c.env.DB.prepare('UPDATE clientes SET whatsapp = ? WHERE nome_guerra = ? COLLATE NOCASE')
      .bind(whatsappClean, trigramaClean).run();
  }

  const token = await sign(
    { tipo: 'usuario', id: userId, email: emailClean, trigrama: trigramaClean },
    c.env.JWT_SECRET,
    720
  );

  return c.json({
    token,
    user: {
      id: userId, email: emailClean, trigrama: trigramaClean, saram: saramClean,
      whatsapp: whatsappClean, foto_url: null, categoria, sala_cafe: salaCafe,
      is_visitante: 0, esquadrao_origem: null, expira_em: null, acesso_pausado: 0, acesso_bloqueado: false,
    }
  }, 201);
});

// Publico: cadastro de visitante
usuarios.post('/cadastro/visitante', async (c) => {
  const { email, senha, trigrama, saram, whatsapp, categoria, esquadrao_origem, aceite_lgpd } = await c.req.json<{
    email: string; senha: string; trigrama: string; saram: string; whatsapp: string;
    categoria: string; esquadrao_origem: string; aceite_lgpd?: boolean;
  }>();

  if (!email || !senha || !trigrama || !saram || !whatsapp || !categoria || !esquadrao_origem) {
    return c.json({ error: 'Todos os campos são obrigatórios (inclusive esquadrão de origem)' }, 400);
  }
  if (!aceite_lgpd) {
    return c.json({ error: 'Você precisa aceitar a Política de Privacidade para se cadastrar' }, 400);
  }
  if (!isCategoriaValida(categoria)) return c.json({ error: 'Categoria militar inválida' }, 400);
  if (senha.length < 6) return c.json({ error: 'Senha deve ter no mínimo 6 caracteres' }, 400);

  const trigramaClean = trigrama.trim().toUpperCase();
  if (!/^[A-ZÀ-ÚÖ]{3}$/.test(trigramaClean)) return c.json({ error: 'Trigrama deve ter exatamente 3 letras' }, 400);

  const saramClean = saram.trim();
  if (!/^\d+$/.test(saramClean)) return c.json({ error: 'SARAM deve conter apenas números' }, 400);

  const emailClean = email.trim().toLowerCase();
  const esquadraoClean = esquadrao_origem.trim().toUpperCase();

  const existEmail = await c.env.DB.prepare('SELECT id FROM usuarios WHERE email = ?').bind(emailClean).first();
  if (existEmail) return c.json({ error: 'Email já cadastrado' }, 409);

  const existTrigrama = await c.env.DB.prepare('SELECT id FROM usuarios WHERE trigrama = ?').bind(trigramaClean).first();
  if (existTrigrama) return c.json({ error: 'Trigrama já cadastrado' }, 409);

  const existSaram = await c.env.DB.prepare('SELECT id FROM usuarios WHERE saram = ?').bind(saramClean).first();
  if (existSaram) return c.json({ error: 'SARAM já cadastrado' }, 409);

  const senhaHash = await hashPassword(senha);
  const whatsappClean = whatsapp.trim();
  const salaCafe = derivarSalaCafe(categoria as Categoria);
  const expiraEm = calcularExpiracaoVisitante(30);

  const { results } = await c.env.DB.prepare(
    `INSERT INTO usuarios (email, senha_hash, trigrama, saram, whatsapp, categoria, sala_cafe,
       is_visitante, esquadrao_origem, expira_em, permite_fiado, aceitou_lgpd_em)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 0, datetime('now')) RETURNING id`
  ).bind(emailClean, senhaHash, trigramaClean, saramClean, whatsappClean, categoria, salaCafe, esquadraoClean, expiraEm).all<{ id: number }>();

  const userId = results[0].id;

  const existCliente = await c.env.DB.prepare(
    'SELECT id FROM clientes WHERE nome_guerra = ? COLLATE NOCASE'
  ).bind(trigramaClean).first();

  if (!existCliente) {
    await c.env.DB.prepare(
      'INSERT INTO clientes (nome_guerra, whatsapp, visitante, esquadrao_origem) VALUES (?, ?, 1, ?)'
    ).bind(trigramaClean, whatsappClean, esquadraoClean).run();
  } else {
    await c.env.DB.prepare(
      'UPDATE clientes SET whatsapp = ?, visitante = 1, esquadrao_origem = ? WHERE nome_guerra = ? COLLATE NOCASE'
    ).bind(whatsappClean, esquadraoClean, trigramaClean).run();
  }

  const token = await sign(
    { tipo: 'usuario', id: userId, email: emailClean, trigrama: trigramaClean },
    c.env.JWT_SECRET,
    720
  );

  return c.json({
    token,
    user: {
      id: userId, email: emailClean, trigrama: trigramaClean, saram: saramClean,
      whatsapp: whatsappClean, foto_url: null, categoria, sala_cafe: salaCafe,
      is_visitante: 1, esquadrao_origem: esquadraoClean,
      expira_em: expiraEm, acesso_pausado: 0, acesso_bloqueado: false,
      permite_fiado: 0,
    }
  }, 201);
});

// Publico: login
usuarios.post('/login', async (c) => {
  const { email, senha } = await c.req.json<{ email: string; senha: string }>();

  if (!email || !senha) return c.json({ error: 'Email e senha obrigatórios' }, 400);

  const user = await c.env.DB.prepare(
    'SELECT id, email, senha_hash, trigrama, saram, whatsapp, foto_url, ativo, categoria, sala_cafe, is_visitante, esquadrao_origem, expira_em, acesso_pausado, permite_fiado FROM usuarios WHERE email = ?'
  ).bind(email.trim().toLowerCase()).first<{
    id: number; email: string; senha_hash: string; trigrama: string; saram: string;
    whatsapp: string; foto_url: string | null; ativo: number;
    categoria: string; sala_cafe: string | null;
    is_visitante: number; esquadrao_origem: string | null; expira_em: string | null; acesso_pausado: number;
    permite_fiado: number;
  }>();

  if (!user) return c.json({ error: 'Email ou senha incorretos' }, 401);
  if (!user.ativo) return c.json({ error: 'Conta desativada. Procure o administrador.' }, 403);

  const valid = await verifyPassword(senha, user.senha_hash);
  if (!valid) return c.json({ error: 'Email ou senha incorretos' }, 401);

  const token = await sign(
    { tipo: 'usuario', id: user.id, email: user.email, trigrama: user.trigrama },
    c.env.JWT_SECRET,
    720
  );

  const acesso_bloqueado = visitanteBloqueado({
    is_visitante: user.is_visitante,
    expira_em: user.expira_em,
    acesso_pausado: user.acesso_pausado,
  });

  return c.json({
    token,
    user: {
      id: user.id, email: user.email, trigrama: user.trigrama, saram: user.saram,
      whatsapp: user.whatsapp, foto_url: user.foto_url, categoria: user.categoria, sala_cafe: user.sala_cafe,
      is_visitante: user.is_visitante, esquadrao_origem: user.esquadrao_origem,
      expira_em: user.expira_em, acesso_pausado: user.acesso_pausado, acesso_bloqueado,
      permite_fiado: user.permite_fiado,
    }
  });
});

// Usuario logado: dados do perfil
usuarios.get('/me', userAuthMiddleware, async (c) => {
  const userId = c.get('userId');
  const user = await c.env.DB.prepare(
    'SELECT id, email, trigrama, saram, whatsapp, foto_url, categoria, sala_cafe, is_visitante, esquadrao_origem, expira_em, acesso_pausado, permite_fiado, created_at FROM usuarios WHERE id = ?'
  ).bind(userId).first<{
    is_visitante: number; expira_em: string | null; acesso_pausado: number;
    [k: string]: unknown;
  }>();

  if (!user) return c.json({ error: 'Usuário não encontrado' }, 404);

  const acesso_bloqueado = visitanteBloqueado({
    is_visitante: user.is_visitante,
    expira_em: user.expira_em,
    acesso_pausado: user.acesso_pausado,
  });

  return c.json({ ...user, acesso_bloqueado });
});

// Usuario logado: atualizar perfil
usuarios.put('/me', userAuthMiddleware, async (c) => {
  const userId = c.get('userId');
  const { whatsapp, saram } = await c.req.json<{ whatsapp?: string; saram?: string }>();

  const updates: string[] = [];
  const params: unknown[] = [];

  if (whatsapp) { updates.push('whatsapp = ?'); params.push(whatsapp.trim()); }
  if (saram) {
    const saramClean = saram.trim();
    if (!/^\d+$/.test(saramClean)) return c.json({ error: 'SARAM deve conter apenas números' }, 400);
    const existSaram = await c.env.DB.prepare('SELECT id FROM usuarios WHERE saram = ? AND id != ?')
      .bind(saramClean, userId).first();
    if (existSaram) return c.json({ error: 'SARAM já cadastrado por outro usuário' }, 409);
    updates.push('saram = ?');
    params.push(saramClean);
  }

  if (!updates.length) return c.json({ error: 'Nenhum campo para atualizar' }, 400);

  params.push(userId);
  await c.env.DB.prepare(`UPDATE usuarios SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();

  if (whatsapp) {
    const trigrama = c.get('userTrigrama');
    await c.env.DB.prepare('UPDATE clientes SET whatsapp = ? WHERE nome_guerra = ? COLLATE NOCASE')
      .bind(whatsapp.trim(), trigrama).run();
  }

  const user = await c.env.DB.prepare(
    'SELECT id, email, trigrama, saram, whatsapp, foto_url, categoria, sala_cafe, is_visitante, esquadrao_origem, expira_em, acesso_pausado, permite_fiado, created_at FROM usuarios WHERE id = ?'
  ).bind(userId).first<{
    is_visitante: number; expira_em: string | null; acesso_pausado: number;
    [k: string]: unknown;
  }>();

  if (!user) return c.json({ error: 'Usuário não encontrado' }, 404);

  const acesso_bloqueado = visitanteBloqueado({
    is_visitante: user.is_visitante,
    expira_em: user.expira_em,
    acesso_pausado: user.acesso_pausado,
  });

  return c.json({ ...user, acesso_bloqueado });
});

// Usuario logado: dashboard
usuarios.get('/me/dashboard', userAuthMiddleware, async (c) => {
  const userId = c.get('userId');
  const trigrama = c.get('userTrigrama');

  const user = await c.env.DB.prepare(
    'SELECT id, email, trigrama, saram, whatsapp, foto_url, categoria, sala_cafe, is_visitante, esquadrao_origem, expira_em, acesso_pausado, permite_fiado, created_at FROM usuarios WHERE id = ?'
  ).bind(userId).first<{ sala_cafe: string | null; is_visitante: number; expira_em: string | null; acesso_pausado: number }>();
  if (!user) return c.json({ error: 'Usuário não encontrado' }, 404);

  const cliente = await c.env.DB.prepare(
    'SELECT id FROM clientes WHERE nome_guerra = ? COLLATE NOCASE'
  ).bind(trigrama).first<{ id: string }>();

  let debitoTotal = 0;
  let ultimosPedidos: unknown[] = [];

  if (cliente) {
    const debitoRow = await c.env.DB.prepare(
      "SELECT COALESCE(SUM(total), 0) as total FROM pedidos WHERE cliente_id = ? AND status IN ('fiado', 'pendente')"
    ).bind(cliente.id).first<{ total: number }>();
    debitoTotal = debitoRow?.total || 0;

    const { results: pedidos } = await c.env.DB.prepare(`
      SELECT id, total, status, metodo_pagamento, created_at, paid_at
      FROM pedidos
      WHERE cliente_id = ?
      ORDER BY created_at DESC
      LIMIT 5
    `).bind(cliente.id).all<{ id: string; total: number; status: string; metodo_pagamento: string; created_at: string; paid_at: string | null }>();

    const pedidoIds = pedidos.map(p => p.id);
    const itensMap = new Map<string, { nome_produto: string; quantidade: number; preco_unitario: number; subtotal: number }[]>();

    if (pedidoIds.length > 0) {
      const placeholders = pedidoIds.map(() => '?').join(',');
      const { results: todosItens } = await c.env.DB.prepare(
        `SELECT pedido_id, nome_produto, quantidade, preco_unitario, subtotal
         FROM itens_pedido WHERE pedido_id IN (${placeholders})`
      ).bind(...pedidoIds).all<{ pedido_id: string; nome_produto: string; quantidade: number; preco_unitario: number; subtotal: number }>();

      for (const item of todosItens) {
        const arr = itensMap.get(item.pedido_id) || [];
        arr.push({
          nome_produto: item.nome_produto,
          quantidade: item.quantidade,
          preco_unitario: item.preco_unitario,
          subtotal: item.subtotal,
        });
        itensMap.set(item.pedido_id, arr);
      }
    }

    ultimosPedidos = pedidos.map(p => ({
      ...p,
      itens: itensMap.get(p.id) || [],
    }));
  }

  let cafeStatus: { mes_atual: string; pago: boolean; valor: number | null; tem_assinatura: boolean } | null = null;

  if (user.sala_cafe && cliente) {
    const now = new Date();
    const mesAtual = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

    const assinante = await c.env.DB.prepare(
      "SELECT id, valor FROM cafe_assinantes WHERE cliente_id = ? AND tipo = ? AND ativo = 1"
    ).bind(cliente.id, user.sala_cafe === 'oficiais' ? 'oficial' : 'graduado').first<{ id: string; valor: number }>();

    if (!assinante) {
      cafeStatus = { mes_atual: mesAtual, pago: false, valor: null, tem_assinatura: false };
    } else {
      const pag = await c.env.DB.prepare(
        "SELECT status, valor FROM cafe_pagamentos WHERE assinante_id = ? AND referencia = ?"
      ).bind(assinante.id, mesAtual).first<{ status: string; valor: number }>();

      cafeStatus = {
        mes_atual: mesAtual,
        pago: pag?.status === 'pago',
        valor: pag?.valor ?? assinante.valor,
        tem_assinatura: true,
      };
    }
  }

  const acesso_bloqueado = visitanteBloqueado({
    is_visitante: user.is_visitante,
    expira_em: user.expira_em,
    acesso_pausado: user.acesso_pausado,
  });

  return c.json({
    user: { ...user, acesso_bloqueado },
    debito_total: debitoTotal,
    ultimos_pedidos: ultimosPedidos,
    cafe_status: cafeStatus,
  });
});

// Usuario logado: status do cafe pessoal
usuarios.get('/me/cafe', userAuthMiddleware, async (c) => {
  const userId = c.get('userId');
  const trigrama = c.get('userTrigrama');

  const user = await c.env.DB.prepare(
    'SELECT sala_cafe, categoria FROM usuarios WHERE id = ?'
  ).bind(userId).first<{ sala_cafe: string | null; categoria: string }>();

  if (!user) return c.json({ error: 'Usuário não encontrado' }, 404);

  if (!user.sala_cafe) {
    return c.json({ tem_assinatura: false, tipo: null, sem_sala: true });
  }

  const cliente = await c.env.DB.prepare(
    'SELECT id FROM clientes WHERE nome_guerra = ? COLLATE NOCASE'
  ).bind(trigrama).first<{ id: string }>();

  if (!cliente) return c.json({ tem_assinatura: false, tipo: user.sala_cafe, sem_sala: false });

  const assinante = await c.env.DB.prepare(
    "SELECT id, valor, tipo, plano FROM cafe_assinantes WHERE cliente_id = ? AND ativo = 1"
  ).bind(cliente.id).first<{ id: string; valor: number; tipo: string; plano: string }>();

  if (!assinante) return c.json({ tem_assinatura: false, tipo: user.sala_cafe, sem_sala: false });

  const now = new Date();
  const mesAtual = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

  const pagMes = await c.env.DB.prepare(
    "SELECT status FROM cafe_pagamentos WHERE assinante_id = ? AND referencia = ?"
  ).bind(assinante.id, mesAtual).first<{ status: string }>();

  const pendRow = await c.env.DB.prepare(
    "SELECT COALESCE(SUM(valor), 0) as total FROM cafe_pagamentos WHERE assinante_id = ? AND status = 'pendente'"
  ).bind(assinante.id).first<{ total: number }>();

  const { results: historico } = await c.env.DB.prepare(
    "SELECT referencia, valor, status, paid_at FROM cafe_pagamentos WHERE assinante_id = ? ORDER BY referencia DESC LIMIT 6"
  ).bind(assinante.id).all();

  return c.json({
    tem_assinatura: true,
    tipo: assinante.tipo,
    plano: assinante.plano,
    valor_mensal: assinante.valor,
    mes_atual: mesAtual,
    mes_atual_pago: pagMes?.status === 'pago',
    total_pendente: pendRow?.total || 0,
    historico,
  });
});

// Usuario logado: upload foto
usuarios.post('/me/foto', userAuthMiddleware, async (c) => {
  const userId = c.get('userId');
  const formData = await c.req.formData();
  const file = formData.get('foto') as File | null;

  if (!file) return c.json({ error: 'Nenhum arquivo enviado' }, 400);
  if (file.size > 2 * 1024 * 1024) return c.json({ error: 'Arquivo muito grande. Máximo 2MB' }, 400);

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
    return c.json({ error: 'Formato não suportado. Use: jpg, png, webp' }, 400);
  }

  const current = await c.env.DB.prepare('SELECT foto_url FROM usuarios WHERE id = ?').bind(userId)
    .first<{ foto_url: string | null }>();
  if (current?.foto_url) {
    const oldKey = current.foto_url.replace('/api/images/', '');
    await c.env.IMAGES.delete(oldKey).catch(() => {});
  }

  const key = `usuarios/${userId}/foto.${ext}`;
  await c.env.IMAGES.put(key, file.stream(), { httpMetadata: { contentType: file.type } });

  const fotoUrl = `/api/images/${key}`;
  await c.env.DB.prepare('UPDATE usuarios SET foto_url = ? WHERE id = ?').bind(fotoUrl, userId).run();

  return c.json({ foto_url: fotoUrl });
});

// Usuario logado: excluir a propria conta (LGPD - direito ao esquecimento)
usuarios.delete('/me', userAuthMiddleware, async (c) => {
  const userId = c.get('userId');
  const trigrama = c.get('userTrigrama');

  // Apaga foto do R2 se existir
  const current = await c.env.DB.prepare('SELECT foto_url FROM usuarios WHERE id = ?').bind(userId)
    .first<{ foto_url: string | null }>();
  if (current?.foto_url) {
    const key = current.foto_url.replace('/api/images/', '');
    await c.env.IMAGES.delete(key).catch(() => {});
  }

  // Apaga registros do cliente ligado (em cascata manual, seguindo padrao de DELETE /api/clientes/:id)
  const cliente = await c.env.DB.prepare('SELECT id FROM clientes WHERE nome_guerra = ? COLLATE NOCASE')
    .bind(trigrama).first<{ id: string }>();

  if (cliente) {
    // Pedidos guloseimas
    const { results: pedidos } = await c.env.DB.prepare('SELECT id FROM pedidos WHERE cliente_id = ?').bind(cliente.id).all<{ id: string }>();
    for (const p of pedidos) {
      await c.env.DB.prepare('DELETE FROM itens_pedido WHERE pedido_id = ?').bind(p.id).run();
    }
    await c.env.DB.prepare('DELETE FROM pedidos WHERE cliente_id = ?').bind(cliente.id).run();

    // Cafe
    const { results: assinantes } = await c.env.DB.prepare('SELECT id FROM cafe_assinantes WHERE cliente_id = ?').bind(cliente.id).all<{ id: string }>();
    for (const a of assinantes) {
      await c.env.DB.prepare('DELETE FROM cafe_pagamentos WHERE assinante_id = ?').bind(a.id).run();
    }
    await c.env.DB.prepare('DELETE FROM cafe_assinantes WHERE cliente_id = ?').bind(cliente.id).run();

    // Loja
    const { results: lojaPedidos } = await c.env.DB.prepare('SELECT id FROM loja_pedidos WHERE cliente_id = ?').bind(cliente.id).all<{ id: string }>();
    for (const p of lojaPedidos) {
      await c.env.DB.prepare('DELETE FROM loja_itens_pedido WHERE pedido_id = ?').bind(p.id).run();
      await c.env.DB.prepare('DELETE FROM loja_parcelas WHERE pedido_id = ?').bind(p.id).run();
    }
    await c.env.DB.prepare('DELETE FROM loja_pedidos WHERE cliente_id = ?').bind(cliente.id).run();

    // Cliente
    await c.env.DB.prepare('DELETE FROM clientes WHERE id = ?').bind(cliente.id).run();
  }

  // Usuario
  await c.env.DB.prepare('DELETE FROM usuarios WHERE id = ?').bind(userId).run();

  return c.json({ ok: true });
});

// Usuario logado: remover foto
usuarios.delete('/me/foto', userAuthMiddleware, async (c) => {
  const userId = c.get('userId');
  const current = await c.env.DB.prepare('SELECT foto_url FROM usuarios WHERE id = ?').bind(userId)
    .first<{ foto_url: string | null }>();

  if (current?.foto_url) {
    const key = current.foto_url.replace('/api/images/', '');
    await c.env.IMAGES.delete(key).catch(() => {});
  }

  await c.env.DB.prepare('UPDATE usuarios SET foto_url = NULL WHERE id = ?').bind(userId).run();
  return c.json({ ok: true });
});

// Admin: listar usuarios
usuarios.get('/admin/lista', authMiddleware, async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT u.id, u.email, u.trigrama, u.saram, u.whatsapp, u.foto_url, u.categoria, u.sala_cafe, u.ativo,
            u.is_visitante, u.esquadrao_origem, u.expira_em, u.acesso_pausado, u.created_at,
            c.id AS cliente_id
     FROM usuarios u
     LEFT JOIN clientes c ON c.nome_guerra = u.trigrama COLLATE NOCASE
     ORDER BY u.trigrama`
  ).all();
  return c.json(results);
});

// Admin: resetar senha
usuarios.put('/admin/:id/senha', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const { nova_senha } = await c.req.json<{ nova_senha: string }>();

  if (!nova_senha || nova_senha.length < 6) {
    return c.json({ error: 'Senha deve ter no mínimo 6 caracteres' }, 400);
  }

  const senhaHash = await hashPassword(nova_senha);
  const result = await c.env.DB.prepare('UPDATE usuarios SET senha_hash = ? WHERE id = ?')
    .bind(senhaHash, id).run();

  if (!result.meta.changes) return c.json({ error: 'Usuário não encontrado' }, 404);
  return c.json({ ok: true });
});

// Admin: atualizar categoria
usuarios.put('/admin/:id/categoria', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const { categoria } = await c.req.json<{ categoria: string }>();

  if (!isCategoriaValida(categoria)) return c.json({ error: 'Categoria inválida' }, 400);

  const salaCafe = derivarSalaCafe(categoria as Categoria);

  const result = await c.env.DB.prepare(
    'UPDATE usuarios SET categoria = ?, sala_cafe = ? WHERE id = ?'
  ).bind(categoria, salaCafe, id).run();

  if (!result.meta.changes) return c.json({ error: 'Usuário não encontrado' }, 404);
  return c.json({ ok: true, categoria, sala_cafe: salaCafe });
});

// Admin: atualizar permite_fiado
usuarios.put('/admin/:id/fiado', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const { permite_fiado } = await c.req.json<{ permite_fiado: number }>();

  if (permite_fiado !== 0 && permite_fiado !== 1) {
    return c.json({ error: 'permite_fiado deve ser 0 ou 1' }, 400);
  }

  const result = await c.env.DB.prepare(
    'UPDATE usuarios SET permite_fiado = ? WHERE id = ?'
  ).bind(permite_fiado, id).run();

  if (!result.meta.changes) return c.json({ error: 'Usuário não encontrado' }, 404);
  return c.json({ ok: true, permite_fiado });
});

// Admin: atualizar campos de visitante
usuarios.put('/admin/:id/visitante', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const { expira_em, acesso_pausado } = await c.req.json<{ expira_em?: string; acesso_pausado?: number }>();

  const u = await c.env.DB.prepare('SELECT is_visitante FROM usuarios WHERE id = ?').bind(id)
    .first<{ is_visitante: number }>();
  if (!u) return c.json({ error: 'Usuário não encontrado' }, 404);
  if (u.is_visitante !== 1) return c.json({ error: 'Esse usuário não é visitante' }, 400);

  const updates: string[] = [];
  const params: unknown[] = [];

  if (typeof expira_em === 'string') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expira_em)) return c.json({ error: 'Data inválida (use YYYY-MM-DD)' }, 400);
    updates.push('expira_em = ?');
    params.push(expira_em);
  }

  if (typeof acesso_pausado === 'number') {
    updates.push('acesso_pausado = ?');
    params.push(acesso_pausado ? 1 : 0);
  }

  if (!updates.length) return c.json({ error: 'Nenhum campo para atualizar' }, 400);

  params.push(id);
  await c.env.DB.prepare(`UPDATE usuarios SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();

  return c.json({ ok: true });
});

// Admin: buscar usuario pelo trigrama
usuarios.get('/admin/por-trigrama/:trigrama', authMiddleware, async (c) => {
  const trigrama = (c.req.param('trigrama') || '').toUpperCase();
  const user = await c.env.DB.prepare(
    `SELECT u.id, u.email, u.trigrama, u.saram, u.whatsapp, u.foto_url, u.categoria, u.sala_cafe, u.ativo,
            u.is_visitante, u.esquadrao_origem, u.expira_em, u.acesso_pausado, u.created_at,
            c.id AS cliente_id
     FROM usuarios u
     LEFT JOIN clientes c ON c.nome_guerra = u.trigrama COLLATE NOCASE
     WHERE u.trigrama = ? COLLATE NOCASE`
  ).bind(trigrama).first();

  if (!user) return c.json(null);
  return c.json(user);
});

// Admin: desativar usuario
usuarios.put('/admin/:id/desativar', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const result = await c.env.DB.prepare('UPDATE usuarios SET ativo = 0 WHERE id = ?').bind(id).run();
  if (!result.meta.changes) return c.json({ error: 'Usuário não encontrado' }, 404);
  return c.json({ ok: true });
});

// Admin: ativar usuario
usuarios.put('/admin/:id/ativar', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const result = await c.env.DB.prepare('UPDATE usuarios SET ativo = 1 WHERE id = ?').bind(id).run();
  if (!result.meta.changes) return c.json({ error: 'Usuário não encontrado' }, 404);
  return c.json({ ok: true });
});

export default usuarios;
