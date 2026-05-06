import { Hono } from 'hono';
import { sign } from '../lib/jwt';
import { hashPassword, verifyPassword } from '../lib/password';
import { userAuthMiddleware } from '../middleware/userAuth';
import { authMiddleware, superAdminMiddleware } from '../middleware/auth';
import { isCategoriaValida, derivarSalaCafe, type Categoria } from '../lib/categoria';
import { visitanteBloqueado, calcularExpiracaoVisitante } from '../lib/visitante';
import { checkRateLimit, recordAttempt, clearAttempts, clientKey } from '../lib/rateLimit';
import { audit } from '../lib/audit';
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
    `INSERT INTO usuarios (email, senha_hash, trigrama, saram, whatsapp, categoria, sala_cafe, aceitou_lgpd_em, data_nascimento)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), NULL) RETURNING id`
  ).bind(emailClean, senhaHash, trigramaClean, saramClean, whatsappClean, categoria, salaCafe).all<{ id: number }>();

  const userId = results[0].id;

  // Tenta encontrar cliente preexistente pelo SARAM (âncora estável) ou Trigrama
  let existCliente = await c.env.DB.prepare(
    'SELECT id FROM clientes WHERE saram = ?'
  ).bind(saramClean).first<{ id: string }>();

  if (!existCliente) {
    existCliente = await c.env.DB.prepare(
      'SELECT id FROM clientes WHERE nome_guerra = ? COLLATE NOCASE'
    ).bind(trigramaClean).first<{ id: string }>();
  }

  if (!existCliente) {
    await c.env.DB.prepare('INSERT INTO clientes (nome_guerra, saram, whatsapp) VALUES (?, ?, ?)')
      .bind(trigramaClean, saramClean, whatsappClean).run();
  } else {
    await c.env.DB.prepare('UPDATE clientes SET saram = ?, whatsapp = ? WHERE nome_guerra = ? COLLATE NOCASE')
      .bind(saramClean, whatsappClean, trigramaClean).run();
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
       is_visitante, esquadrao_origem, expira_em, permite_fiado, aceitou_lgpd_em, data_nascimento)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 0, datetime('now'), NULL) RETURNING id`
  ).bind(emailClean, senhaHash, trigramaClean, saramClean, whatsappClean, categoria, salaCafe, esquadraoClean, expiraEm).all<{ id: number }>();

  const userId = results[0].id;

  // Tenta encontrar cliente preexistente pelo SARAM ou Trigrama
  let existCliente = await c.env.DB.prepare(
    'SELECT id FROM clientes WHERE saram = ?'
  ).bind(saramClean).first<{ id: string }>();

  if (!existCliente) {
    existCliente = await c.env.DB.prepare(
      'SELECT id FROM clientes WHERE nome_guerra = ? COLLATE NOCASE'
    ).bind(trigramaClean).first<{ id: string }>();
  }

  if (!existCliente) {
    await c.env.DB.prepare(
      'INSERT INTO clientes (nome_guerra, saram, whatsapp, visitante, esquadrao_origem) VALUES (?, ?, ?, 1, ?)'
    ).bind(trigramaClean, saramClean, whatsappClean, esquadraoClean).run();
  } else {
    await c.env.DB.prepare(
      'UPDATE clientes SET saram = ?, whatsapp = ?, visitante = 1, esquadrao_origem = ? WHERE nome_guerra = ? COLLATE NOCASE'
    ).bind(saramClean, whatsappClean, esquadraoClean, trigramaClean).run();
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

  const key = `${clientKey(c)}:${email.trim().toLowerCase()}`;
  const rl = await checkRateLimit(c, 'user_login', key, 8, 15);
  if (!rl.ok) return c.json({ error: `Muitas tentativas. Tente de novo em ${rl.retry_after_min} minutos.` }, 429);

  const user = await c.env.DB.prepare(
    'SELECT id, email, senha_hash, trigrama, saram, whatsapp, foto_url, ativo, categoria, sala_cafe, is_visitante, esquadrao_origem, expira_em, acesso_pausado, permite_fiado FROM usuarios WHERE email = ?'
  ).bind(email.trim().toLowerCase()).first<{
    id: number; email: string; senha_hash: string; trigrama: string; saram: string;
    whatsapp: string; foto_url: string | null; ativo: number;
    categoria: string; sala_cafe: string | null;
    is_visitante: number; esquadrao_origem: string | null; expira_em: string | null; acesso_pausado: number;
    permite_fiado: number;
  }>();

  if (!user) { await recordAttempt(c, 'user_login', key); return c.json({ error: 'Email ou senha incorretos' }, 401); }
  if (!user.ativo) return c.json({ error: 'Conta desativada. Procure o administrador.' }, 403);

  const valid = await verifyPassword(senha, user.senha_hash);
  if (!valid) { await recordAttempt(c, 'user_login', key); return c.json({ error: 'Email ou senha incorretos' }, 401); }
  await clearAttempts(c, 'user_login', key);

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
    'SELECT id, email, trigrama, saram, whatsapp, foto_url, categoria, sala_cafe, is_visitante, esquadrao_origem, expira_em, acesso_pausado, permite_fiado, data_nascimento, created_at FROM usuarios WHERE id = ?'
  ).bind(userId).first<any>();

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
  const { whatsapp, saram, data_nascimento } = await c.req.json<{ whatsapp?: string; saram?: string; data_nascimento?: string | null }>();

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

  if (data_nascimento !== undefined) {
    updates.push('data_nascimento = ?');
    params.push(data_nascimento);
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
    'SELECT id, email, trigrama, saram, whatsapp, foto_url, categoria, sala_cafe, is_visitante, esquadrao_origem, expira_em, acesso_pausado, permite_fiado, data_nascimento, created_at FROM usuarios WHERE id = ?'
  ).bind(userId).first<any>();

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
    'SELECT id, email, trigrama, saram, whatsapp, foto_url, categoria, sala_cafe, is_visitante, esquadrao_origem, expira_em, acesso_pausado, permite_fiado, created_at, data_nascimento, niver_titulo, niver_texto, niver_imagem_url FROM usuarios WHERE id = ?'
  ).bind(userId).first<{ sala_cafe: string | null; is_visitante: number; expira_em: string | null; acesso_pausado: number; data_nascimento: string | null; niver_titulo: string | null; niver_texto: string | null; niver_imagem_url: string | null }>();
  if (!user) return c.json({ error: 'Usuário não encontrado' }, 404);

  const cliente = await c.env.DB.prepare(
    'SELECT id FROM clientes WHERE nome_guerra = ? COLLATE NOCASE'
  ).bind(trigrama).first<{ id: string }>();

  let debitoTotal = 0;
  let totalGastoCantina = 0;
  let totalPagoCantina = 0;
  let totalComprasCantina = 0;
  let ultimosPedidos: unknown[] = [];

  if (cliente) {
    const debitoRow = await c.env.DB.prepare(
      "SELECT COALESCE(SUM(total), 0) as total FROM pedidos WHERE cliente_id = ? AND status IN ('fiado', 'pendente')"
    ).bind(cliente.id).first<{ total: number }>();
    debitoTotal = debitoRow?.total || 0;

    const totaisRow = await c.env.DB.prepare(
      `SELECT
         COALESCE(SUM(total), 0) as gasto,
         COALESCE(SUM(CASE WHEN status = 'pago' THEN total ELSE 0 END), 0) as pago,
         COUNT(*) as compras
       FROM pedidos WHERE cliente_id = ?`
    ).bind(cliente.id).first<{ gasto: number; pago: number; compras: number }>();
    totalGastoCantina = totaisRow?.gasto || 0;
    totalPagoCantina = totaisRow?.pago || 0;
    totalComprasCantina = totaisRow?.compras || 0;

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
      "SELECT id, valor, plano FROM cafe_assinantes WHERE cliente_id = ? AND tipo = ? AND ativo = 1"
    ).bind(cliente.id, user.sala_cafe === 'oficiais' ? 'oficial' : 'graduado').first<{ id: string; valor: number; plano: string }>();

    if (!assinante) {
      cafeStatus = { mes_atual: mesAtual, pago: false, valor: null, tem_assinatura: false };
    } else {
      const referencia = assinante.plano === 'anual' ? String(now.getUTCFullYear()) : mesAtual;
      const pag = await c.env.DB.prepare(
        "SELECT status, valor FROM cafe_pagamentos WHERE assinante_id = ? AND referencia = ?"
      ).bind(assinante.id, referencia).first<{ status: string; valor: number }>();

      cafeStatus = {
        mes_atual: referencia,
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

  // Café totais
  let cafePagoTotal = 0;
  let cafePendenteTotal = 0;
  if (user.sala_cafe && cliente) {
    const row = await c.env.DB.prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN p.status = 'pago' THEN p.valor ELSE 0 END), 0) as pago,
         COALESCE(SUM(CASE WHEN p.status = 'pendente' THEN p.valor ELSE 0 END), 0) as pendente
       FROM cafe_pagamentos p
       INNER JOIN cafe_assinantes a ON a.id = p.assinante_id
       WHERE a.cliente_id = ?`
    ).bind(cliente.id).first<{ pago: number; pendente: number }>();
    cafePagoTotal = row?.pago || 0;
    cafePendenteTotal = row?.pendente || 0;
  }

  // Ximboca totais (match por nome = trigrama)
  let ximbocaPagoTotal = 0;
  let ximbocaPendenteTotal = 0;
  const row = await c.env.DB.prepare(
    `SELECT
       COALESCE(SUM(CASE WHEN xp.status = 'pago' THEN COALESCE(xp.valor_individual, xe.valor_por_pessoa) ELSE 0 END), 0) as pago,
       COALESCE(SUM(CASE WHEN xp.status != 'pago' THEN COALESCE(xp.valor_individual, xe.valor_por_pessoa) ELSE 0 END), 0) as pendente
     FROM ximboca_participantes xp
     INNER JOIN ximboca_eventos xe ON xe.id = xp.evento_id
     WHERE xp.nome = ? COLLATE NOCASE`
  ).bind(trigrama).first<{ pago: number; pendente: number }>();
  ximbocaPagoTotal = row?.pago || 0;
  ximbocaPendenteTotal = row?.pendente || 0;

  const totalPagoGeral = totalPagoCantina + cafePagoTotal + ximbocaPagoTotal;
  const totalPendenteGeral = debitoTotal + cafePendenteTotal + ximbocaPendenteTotal;

  return c.json({
    user: { ...user, acesso_bloqueado },
    debito_total: debitoTotal,
    ultimos_pedidos: ultimosPedidos,
    cafe_status: cafeStatus,
    totais: {
      cantina: { gasto: totalGastoCantina, pago: totalPagoCantina, pendente: debitoTotal, compras: totalComprasCantina },
      cafe: { pago: cafePagoTotal, pendente: cafePendenteTotal },
      ximboca: { pago: ximbocaPagoTotal, pendente: ximbocaPendenteTotal },
      geral: { pago: totalPagoGeral, pendente: totalPendenteGeral },
    },
    aniversario: await checarAniversario(user, c.env)
  });
});

async function checarAniversario(u: any, env: any) {
  if (!u.data_nascimento) return null;
  const hoje = new Date();
  // Obtém MM-DD em fuso local/Brasília (simplificado)
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const dia = String(hoje.getDate()).padStart(2, '0');
  const hojeMMDD = `${mes}-${dia}`;
  const niverMMDD = u.data_nascimento.slice(5, 10); // Assume YYYY-MM-DD
  if (hojeMMDD !== niverMMDD) return null;

  // Busca config padrão
  const config = await env.DB.prepare('SELECT niver_titulo_padrao, niver_texto_padrao, niver_imagem_url_padrao FROM config').first<{ niver_titulo_padrao: string; niver_texto_padrao: string; niver_imagem_url_padrao: string }>();

  return {
    titulo: u.niver_titulo || config?.niver_titulo_padrao || 'Feliz Aniversário!',
    texto: u.niver_texto || config?.niver_texto_padrao || 'O 1/10 GpAv deseja a você muitas felicidades e sucesso!',
    imagem_url: u.niver_imagem_url || config?.niver_imagem_url_padrao || null
  };
}

// Admin: listar aniversariantes
usuarios.get('/admin/aniversariantes', authMiddleware, async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT id, trigrama, categoria, data_nascimento, niver_titulo, niver_texto, niver_imagem_url
    FROM usuarios 
    WHERE data_nascimento IS NOT NULL 
    ORDER BY SUBSTR(data_nascimento, 6) ASC
  `).all();
  
  return c.json(results);
});

// Admin: salvar homenagem personalizada
usuarios.put('/admin/:id/homenagem', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const { niver_titulo, niver_texto, niver_imagem_url } = await c.req.json();

  await c.env.DB.prepare(`
    UPDATE usuarios 
    SET niver_titulo = ?, niver_texto = ?, niver_imagem_url = ? 
    WHERE id = ?
  `).bind(niver_titulo, niver_texto, niver_imagem_url, id).run();

  await audit(c, 'configurar_homenagem_aniversario', 'usuarios', id, null, { niver_titulo });

  return c.json({ ok: true });
});

// Usuario logado: meu extrato completo (self-service)
usuarios.get('/me/extrato', userAuthMiddleware, async (c) => {
  const trigrama = c.get('userTrigrama');
  const cliente = await c.env.DB.prepare(
    'SELECT * FROM clientes WHERE nome_guerra = ? COLLATE NOCASE'
  ).bind(trigrama).first<{ id: string }>();

  const [gs, lj, cf, xb] = await Promise.all([
    cliente ? c.env.DB.prepare(`
      SELECT p.*, GROUP_CONCAT(ip.nome_produto || ' x' || ip.quantidade, ', ') as itens_resumo
      FROM pedidos p LEFT JOIN itens_pedido ip ON ip.pedido_id = p.id
      WHERE p.cliente_id = ? GROUP BY p.id ORDER BY p.created_at DESC
    `).bind(cliente.id).all() : Promise.resolve({ results: [] as unknown[] }),
    cliente ? c.env.DB.prepare(`
      SELECT p.*, GROUP_CONCAT(ip.nome_produto || ' x' || ip.quantidade, ', ') as itens_resumo
      FROM loja_pedidos p LEFT JOIN loja_itens_pedido ip ON ip.pedido_id = p.id
      WHERE p.cliente_id = ? GROUP BY p.id ORDER BY p.created_at DESC
    `).bind(cliente.id).all() : Promise.resolve({ results: [] as unknown[] }),
    cliente ? c.env.DB.prepare(`
      SELECT cp.*, ca.tipo as cafe_tipo, ca.plano as cafe_plano
      FROM cafe_pagamentos cp JOIN cafe_assinantes ca ON ca.id = cp.assinante_id
      WHERE ca.cliente_id = ? ORDER BY cp.referencia DESC
    `).bind(cliente.id).all() : Promise.resolve({ results: [] as unknown[] }),
    c.env.DB.prepare(`
      SELECT xp.*, xe.nome as evento_nome, xe.data as evento_data, xe.valor_por_pessoa
      FROM ximboca_participantes xp JOIN ximboca_eventos xe ON xe.id = xp.evento_id
      WHERE xp.nome = ? COLLATE NOCASE ORDER BY xe.data DESC
    `).bind(trigrama).all(),
  ]);

  return c.json({
    cliente: cliente || { nome_guerra: trigrama },
    guloseimas: gs.results,
    loja: lj.results,
    cafe: cf.results,
    ximboca: xb.results,
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
  const anoAtual = String(now.getUTCFullYear());
  const mesAtual = `${anoAtual}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

  // Para plano anual: referencia e o ano (ex: "2026")
  // Para plano mensal: referencia e o mes (ex: "2026-04")
  const referenciaAtual = assinante.plano === 'anual' ? anoAtual : mesAtual;

  const pagAtual = await c.env.DB.prepare(
    "SELECT status FROM cafe_pagamentos WHERE assinante_id = ? AND referencia = ?"
  ).bind(assinante.id, referenciaAtual).first<{ status: string }>();

  const pendRow = await c.env.DB.prepare(
    "SELECT COALESCE(SUM(valor), 0) as total FROM cafe_pagamentos WHERE assinante_id = ? AND status = 'pendente'"
  ).bind(assinante.id).first<{ total: number }>();

  const { results: historico } = await c.env.DB.prepare(
    "SELECT id, referencia, valor, status, paid_at FROM cafe_pagamentos WHERE assinante_id = ? ORDER BY referencia DESC LIMIT 6"
  ).bind(assinante.id).all();

  return c.json({
    tem_assinatura: true,
    tipo: assinante.tipo,
    plano: assinante.plano,
    valor_mensal: assinante.valor,
    mes_atual: referenciaAtual,
    mes_atual_pago: pagAtual?.status === 'pago',
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
            u.is_visitante, u.esquadrao_origem, u.expira_em, u.acesso_pausado, u.created_at, u.data_nascimento,
            c.id AS cliente_id
     FROM usuarios u
     LEFT JOIN clientes c ON c.saram = u.saram
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
            u.is_visitante, u.esquadrao_origem, u.expira_em, u.acesso_pausado, u.created_at, u.data_nascimento,
            c.id AS cliente_id
     FROM usuarios u
     LEFT JOIN clientes c ON c.saram = u.saram
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

// Admin: criar usuario
usuarios.post('/admin', authMiddleware, async (c) => {
  const { email, senha, trigrama, saram, whatsapp, categoria, is_visitante, esquadrao_origem, expira_em, data_nascimento } = await c.req.json<{
    email: string; senha: string; trigrama: string; saram: string; whatsapp: string;
    categoria: string; is_visitante?: number; esquadrao_origem?: string; expira_em?: string; data_nascimento?: string;
  }>();

  if (!email || !senha || !trigrama || !saram || !whatsapp || !categoria) {
    return c.json({ error: 'Campos obrigatórios: email, senha, trigrama, saram, whatsapp, categoria' }, 400);
  }

  const tri = trigrama.trim().toUpperCase();
  if (!/^[A-ZÀ-ÚÖ]{3}$/.test(tri)) return c.json({ error: 'Trigrama deve ter exatamente 3 letras' }, 400);

  const sa = saram.trim();
  if (!/^\d+$/.test(sa)) return c.json({ error: 'SARAM deve conter apenas números' }, 400);

  const em = email.trim().toLowerCase();
  
  const existEmail = await c.env.DB.prepare('SELECT id FROM usuarios WHERE email = ?').bind(em).first();
  if (existEmail) return c.json({ error: 'Email já cadastrado' }, 409);

  const existTrigrama = await c.env.DB.prepare('SELECT id FROM usuarios WHERE trigrama = ?').bind(tri).first();
  if (existTrigrama) return c.json({ error: 'Trigrama já cadastrado' }, 409);

  const existSaram = await c.env.DB.prepare('SELECT id FROM usuarios WHERE saram = ?').bind(sa).first();
  if (existSaram) return c.json({ error: 'SARAM já cadastrado' }, 409);

  const senhaHash = await hashPassword(senha);
  const wp = whatsapp.trim();
  const salaCafe = derivarSalaCafe(categoria as Categoria);

  const columns = ['email', 'senha_hash', 'trigrama', 'saram', 'whatsapp', 'categoria', 'sala_cafe', 'ativo'];
  const values = [em, senhaHash, tri, sa, wp, categoria, salaCafe, 1];
  const placeholders = ['?', '?', '?', '?', '?', '?', '?', '?'];

  if (is_visitante === 1) {
    columns.push('is_visitante', 'esquadrao_origem', 'expira_em');
    values.push(1, esquadrao_origem?.trim().toUpperCase() || null, expira_em || null);
    placeholders.push('?', '?', '?');
  }

  if (data_nascimento) {
    columns.push('data_nascimento');
    values.push(data_nascimento);
    placeholders.push('?');
  }

  let userId: number;
  try {
    const { results } = await c.env.DB.prepare(
      `INSERT INTO usuarios (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING id`
    ).bind(...values).all<{ id: number }>();
    userId = results[0].id;
  } catch (err) {
    console.error('Erro ao criar usuario:', err);
    return c.json({ error: 'Erro ao criar usuário no banco. Verifique as colunas de aniversário.' }, 500);
  }

  // Sincroniza tabela clientes
  const existCliente = await c.env.DB.prepare(
    'SELECT id FROM clientes WHERE nome_guerra = ? COLLATE NOCASE'
  ).bind(tri).first();

  if (!existCliente) {
    await c.env.DB.prepare('INSERT INTO clientes (nome_guerra, whatsapp, esquadrao_origem) VALUES (?, ?, ?)')
      .bind(tri, wp, (is_visitante === 1 ? esquadrao_origem?.trim().toUpperCase() || null : null)).run();
  } else {
    await c.env.DB.prepare('UPDATE clientes SET whatsapp = ?, esquadrao_origem = ? WHERE nome_guerra = ? COLLATE NOCASE')
      .bind(wp, (is_visitante === 1 ? esquadrao_origem?.trim().toUpperCase() || null : null), tri).run();
  }

  await audit(c, 'criar_usuario', 'usuarios', String(userId), null, { email: em, trigrama: tri });

  return c.json({ ok: true, id: userId }, 201);
});

// Admin: editar dados gerais do usuario (trigrama, email, saram, whatsapp, esquadrao_origem)
usuarios.put('/admin/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{
    trigrama?: string;
    email?: string;
    saram?: string;
    whatsapp?: string;
    esquadrao_origem?: string | null;
    data_nascimento?: string | null;
  }>();

  const antes = await c.env.DB.prepare(
    'SELECT id, trigrama, email, saram, whatsapp, esquadrao_origem, data_nascimento FROM usuarios WHERE id = ?'
  ).bind(id).first<{ id: number; trigrama: string; email: string; saram: string; whatsapp: string; esquadrao_origem: string | null; data_nascimento: string | null }>();
  if (!antes) return c.json({ error: 'Usuário não encontrado' }, 404);

  const updates: string[] = [];
  const params: unknown[] = [];
  let novoTrigrama: string | null = null;
  let novoWhatsapp: string | null = null;
  let novoEsquadrao: string | null | undefined = undefined;
  let novoSaram: string | null = null;

  if (typeof body.trigrama === 'string') {
    const tri = body.trigrama.trim().toUpperCase();
    if (!/^[A-ZÀ-ÚÖ]{3}$/.test(tri)) return c.json({ error: 'Trigrama deve ter exatamente 3 letras' }, 400);
    if (tri !== antes.trigrama) {
      const ex = await c.env.DB.prepare('SELECT id FROM usuarios WHERE trigrama = ? AND id != ?').bind(tri, id).first();
      if (ex) return c.json({ error: 'Trigrama já cadastrado por outro usuário' }, 409);
      updates.push('trigrama = ?');
      params.push(tri);
      novoTrigrama = tri;
    }
  }

  if (typeof body.email === 'string') {
    const em = body.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return c.json({ error: 'Email inválido' }, 400);
    if (em !== antes.email) {
      const ex = await c.env.DB.prepare('SELECT id FROM usuarios WHERE email = ? AND id != ?').bind(em, id).first();
      if (ex) return c.json({ error: 'Email já cadastrado por outro usuário' }, 409);
      updates.push('email = ?');
      params.push(em);
    }
  }

  if (typeof body.saram === 'string') {
    const sa = body.saram.trim();
    if (!/^\d+$/.test(sa)) return c.json({ error: 'SARAM deve conter apenas números' }, 400);
    if (sa !== antes.saram) {
      const ex = await c.env.DB.prepare('SELECT id FROM usuarios WHERE saram = ? AND id != ?').bind(sa, id).first();
      if (ex) return c.json({ error: 'SARAM já cadastrado por outro usuário' }, 409);
      updates.push('saram = ?');
      params.push(sa);
      novoSaram = sa;
    }
  }

  if (typeof body.whatsapp === 'string') {
    const wp = body.whatsapp.trim();
    if (wp !== antes.whatsapp) {
      updates.push('whatsapp = ?');
      params.push(wp);
      novoWhatsapp = wp;
    }
  }

  if (body.esquadrao_origem !== undefined) {
    const es = body.esquadrao_origem === null ? null : String(body.esquadrao_origem).trim().toUpperCase() || null;
    if (es !== antes.esquadrao_origem) {
      updates.push('esquadrao_origem = ?');
      params.push(es);
      novoEsquadrao = es;
    }
  }

  if (body.data_nascimento !== undefined) {
    const dn = body.data_nascimento === null ? null : String(body.data_nascimento).trim() || null;
    if (dn !== antes.data_nascimento) {
      updates.push('data_nascimento = ?');
      params.push(dn);
    }
  }

  if (!updates.length) return c.json({ error: 'Nenhum campo para atualizar' }, 400);

  params.push(id);
  try {
    await c.env.DB.prepare(`UPDATE usuarios SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();
  } catch (err) {
    console.error('Erro ao atualizar usuario:', err);
    return c.json({ error: 'Erro no banco de dados. Verifique se a coluna data_nascimento existe.' }, 500);
  }

  // Sincroniza tabela clientes (Ancorado pelo SARAM ou Trigrama antigo como fallback)
  if (novoTrigrama || novoWhatsapp !== null || novoEsquadrao !== undefined || novoSaram) {
    const clienteUpdates: string[] = [];
    const clienteParams: unknown[] = [];
    if (novoTrigrama) { clienteUpdates.push('nome_guerra = ?'); clienteParams.push(novoTrigrama); }
    if (novoWhatsapp !== null) { clienteUpdates.push('whatsapp = ?'); clienteParams.push(novoWhatsapp); }
    if (novoEsquadrao !== undefined) { clienteUpdates.push('esquadrao_origem = ?'); clienteParams.push(novoEsquadrao); }
    if (novoSaram) { clienteUpdates.push('saram = ?'); clienteParams.push(novoSaram); }

    if (clienteUpdates.length) {
      // Tenta atualizar primeiro pelo SARAM (âncora estável)
      const res = await c.env.DB.prepare(
        `UPDATE clientes SET ${clienteUpdates.join(', ')} WHERE saram = ?`
      ).bind(...clienteParams, antes.saram).run();

      // Se não encontrou pelo SARAM, tenta pelo Trigrama antigo (fallback)
      if (!res.meta.changes) {
        await c.env.DB.prepare(
          `UPDATE clientes SET ${clienteUpdates.join(', ')} WHERE nome_guerra = ? COLLATE NOCASE`
        ).bind(...clienteParams, antes.trigrama).run();
      }
    }
  }

  const depois = await c.env.DB.prepare(
    `SELECT u.id, u.email, u.trigrama, u.saram, u.whatsapp, u.foto_url, u.categoria, u.sala_cafe, u.ativo,
            u.is_visitante, u.esquadrao_origem, u.expira_em, u.acesso_pausado, u.permite_fiado, u.created_at, u.data_nascimento,
            c.id AS cliente_id
     FROM usuarios u
     LEFT JOIN clientes c ON c.saram = u.saram
     WHERE u.id = ?`
  ).bind(id).first();

  await audit(c, 'editar_usuario', 'usuarios', String(id), antes, depois);
  return c.json(depois);
});

// Admin: excluir usuario (super_admin only). Cascata manual seguindo padrao do DELETE /me
usuarios.delete('/admin/:id', authMiddleware, superAdminMiddleware, async (c) => {
  const id = c.req.param('id');

  const user = await c.env.DB.prepare(
    'SELECT id, trigrama, email, foto_url FROM usuarios WHERE id = ?'
  ).bind(id).first<{ id: number; trigrama: string; email: string; foto_url: string | null }>();
  if (!user) return c.json({ error: 'Usuário não encontrado' }, 404);

  if (user.foto_url) {
    const key = user.foto_url.replace('/api/images/', '');
    await c.env.IMAGES.delete(key).catch(() => {});
  }

  const cliente = await c.env.DB.prepare(
    'SELECT id FROM clientes WHERE nome_guerra = ? COLLATE NOCASE'
  ).bind(user.trigrama).first<{ id: string }>();

  if (cliente) {
    const { results: pedidos } = await c.env.DB.prepare('SELECT id FROM pedidos WHERE cliente_id = ?').bind(cliente.id).all<{ id: string }>();
    for (const p of pedidos) {
      await c.env.DB.prepare('DELETE FROM itens_pedido WHERE pedido_id = ?').bind(p.id).run();
    }
    await c.env.DB.prepare('DELETE FROM pedidos WHERE cliente_id = ?').bind(cliente.id).run();

    const { results: assinantes } = await c.env.DB.prepare('SELECT id FROM cafe_assinantes WHERE cliente_id = ?').bind(cliente.id).all<{ id: string }>();
    for (const a of assinantes) {
      await c.env.DB.prepare('DELETE FROM cafe_pagamentos WHERE assinante_id = ?').bind(a.id).run();
    }
    await c.env.DB.prepare('DELETE FROM cafe_assinantes WHERE cliente_id = ?').bind(cliente.id).run();

    const { results: lojaPedidos } = await c.env.DB.prepare('SELECT id FROM loja_pedidos WHERE cliente_id = ?').bind(cliente.id).all<{ id: string }>();
    for (const p of lojaPedidos) {
      await c.env.DB.prepare('DELETE FROM loja_itens_pedido WHERE pedido_id = ?').bind(p.id).run();
      await c.env.DB.prepare('DELETE FROM loja_parcelas WHERE pedido_id = ?').bind(p.id).run();
    }
    await c.env.DB.prepare('DELETE FROM loja_pedidos WHERE cliente_id = ?').bind(cliente.id).run();

    await c.env.DB.prepare('DELETE FROM clientes WHERE id = ?').bind(cliente.id).run();
  }

  await c.env.DB.prepare('DELETE FROM usuarios WHERE id = ?').bind(id).run();

  await audit(c, 'excluir_usuario', 'usuarios', String(id), { trigrama: user.trigrama, email: user.email }, null);
  return c.json({ ok: true });
});

export default usuarios;
