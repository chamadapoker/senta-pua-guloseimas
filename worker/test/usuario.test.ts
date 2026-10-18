// Caso 3 — usuário: só enxerga/age sobre o que é dele (OWASP A01 — IDOR) e regras de fiado.
import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import {
  api, loginSuper, cadastrarMilitar, cadastrarVisitante, pedidoCantina, produtoCantina, criarProdutoLoja,
  criarAssinante, enviarComprovante,
} from './helpers/fixtures';

describe('extrato e itens de outro usuário', () => {
  it('cada um lê só o próprio extrato (parâmetros no query não trocam o dono)', async () => {
    const a = await cadastrarMilitar({ trigrama: 'AAA' });
    const b = await cadastrarMilitar({ trigrama: 'BBB' });
    const pa = await pedidoCantina(a.token, 'fiado');
    expect(pa.status).toBe(201);

    const extA = await api('/api/usuarios/me/extrato', { token: a.token });
    expect(extA.status).toBe(200);
    expect(extA.body.cliente.nome_guerra).toBe('AAA');
    expect(extA.body.guloseimas.map((p: any) => p.id)).toEqual([pa.body.pedido_id]);

    for (const q of ['', '?trigrama=AAA', '?nome_guerra=AAA', `?cliente_id=${extA.body.cliente.id}`]) {
      const extB = await api(`/api/usuarios/me/extrato${q}`, { token: b.token });
      expect(extB.status).toBe(200);
      expect(extB.body.cliente.nome_guerra).toBe('BBB');
      expect(extB.body.guloseimas).toEqual([]);
    }
  });

  it('extrato sem login => 401; extrato admin de cliente com token de usuário => 401', async () => {
    const a = await cadastrarMilitar({ trigrama: 'AAA' });
    const b = await cadastrarMilitar({ trigrama: 'BBB' });
    const cli = await env.DB.prepare("SELECT id FROM clientes WHERE nome_guerra = 'AAA'").first<{ id: string }>();
    expect((await api('/api/usuarios/me/extrato')).status).toBe(401);
    expect((await api(`/api/clientes/${cli!.id}/extrato`, { token: b.token })).status).toBe(401);
    expect((await api(`/api/clientes/${cli!.id}/extrato-completo`, { token: b.token })).status).toBe(401);
    // admin lê
    const sup = await loginSuper();
    expect((await api(`/api/clientes/${cli!.id}/extrato`, { token: sup.token })).status).toBe(200);
    void a;
  });

  it('não confirma pagamento nem envia comprovante de pedido/mensalidade de outro', async () => {
    const sup = await loginSuper();
    const a = await cadastrarMilitar({ trigrama: 'AAA' });
    const b = await cadastrarMilitar({ trigrama: 'BBB' });
    const pa = await pedidoCantina(a.token, 'fiado');
    const ass = await criarAssinante(sup.token, 'AAA');

    expect((await api(`/api/pedidos/${pa.body.pedido_id}/confirmar-pagamento`, { method: 'PUT', token: b.token })).status).toBe(404);
    expect((await api(`/api/cafe/pagamentos/${ass.primeira_cobranca.id}/confirmar`, { method: 'PUT', token: b.token })).status).toBe(404);
    expect((await enviarComprovante(b.token, 'cantina', pa.body.pedido_id)).status).toBe(403);
    expect((await enviarComprovante(b.token, 'cafe', ass.primeira_cobranca.id)).status).toBe(403);

    // o dono consegue
    expect((await api(`/api/pedidos/${pa.body.pedido_id}/confirmar-pagamento`, { method: 'PUT', token: a.token })).status).toBe(200);
    expect((await enviarComprovante(a.token, 'cantina', pa.body.pedido_id)).status).toBe(201);
  });

  it('comprovantes e notificações: cada um só vê os seus', async () => {
    const a = await cadastrarMilitar({ trigrama: 'AAA' });
    const b = await cadastrarMilitar({ trigrama: 'BBB' });
    const pa = await pedidoCantina(a.token, 'fiado'); // fiado gera notificação "NOVA COMPRA"
    await enviarComprovante(a.token, 'cantina', pa.body.pedido_id);

    expect((await api('/api/comprovantes/me', { token: a.token })).body.length).toBe(1);
    expect((await api('/api/comprovantes/me', { token: b.token })).body).toEqual([]);
    const na = await api('/api/notificacoes/me', { token: a.token });
    expect(na.status).toBe(200);
    const nb = await api('/api/notificacoes/me', { token: b.token });
    expect(JSON.stringify(nb.body)).not.toContain('NOVA COMPRA');
    // marcar como lida notificação de outro não afeta a do dono
    const notif = await env.DB.prepare("SELECT id FROM notificacoes WHERE trigrama = 'AAA'").first<{ id: number }>();
    await api(`/api/notificacoes/${notif!.id}/lida`, { method: 'PUT', token: b.token });
    const lida = await env.DB.prepare('SELECT lida FROM notificacoes WHERE id = ?').bind(notif!.id).first<{ lida: number }>();
    expect(lida!.lida).toBe(0);
  });

  it('meus pedidos da loja: só os do próprio usuário', async () => {
    const sup = await loginSuper();
    const prod = await criarProdutoLoja(sup.token);
    const a = await cadastrarMilitar({ trigrama: 'AAA' });
    const b = await cadastrarMilitar({ trigrama: 'BBB' });
    const r = await api('/api/loja/pedidos', { token: a.token, body: { itens: [{ produto_id: prod.id, quantidade: 1 }], metodo: 'pix' } });
    expect(r.status).toBe(201);
    expect((await api('/api/loja/meus-pedidos', { token: a.token })).body.length).toBe(1);
    expect((await api('/api/loja/meus-pedidos', { token: b.token })).body).toEqual([]);
  });
});

describe('pedido da cantina', () => {
  it('sem login => 401 e nada é gravado', async () => {
    const p = await produtoCantina();
    const r = await api('/api/pedidos', { body: { nome_guerra: 'XYZ', itens: [{ produto_id: p.id, quantidade: 1 }], metodo: 'pix' } });
    expect(r.status).toBe(401);
    const n = await env.DB.prepare('SELECT COUNT(*) as n FROM pedidos').first<{ n: number }>();
    expect(n!.n).toBe(0);
  });

  it('com login: o dono é o do token (nome_guerra/whatsapp do body são ignorados)', async () => {
    const a = await cadastrarMilitar({ trigrama: 'AAA' });
    await cadastrarMilitar({ trigrama: 'VIT' }); // vítima que alguém tentaria endividar
    const r = await pedidoCantina(a.token, 'fiado', { nome_guerra: 'VIT', whatsapp: '000', visitante: true });
    expect(r.status).toBe(201);
    const dono = await env.DB.prepare(
      'SELECT cl.nome_guerra FROM pedidos p JOIN clientes cl ON cl.id = p.cliente_id WHERE p.id = ?',
    ).bind(r.body.pedido_id).first<{ nome_guerra: string }>();
    expect(dono!.nome_guerra).toBe('AAA');
    const vit = await env.DB.prepare(
      "SELECT COUNT(*) as n FROM pedidos p JOIN clientes cl ON cl.id = p.cliente_id WHERE cl.nome_guerra = 'VIT'",
    ).first<{ n: number }>();
    expect(vit!.n).toBe(0);
    // não criou cliente com nome do body
    const fantasma = await env.DB.prepare("SELECT COUNT(*) as n FROM clientes WHERE whatsapp = '000'").first<{ n: number }>();
    expect(fantasma!.n).toBe(0);
  });

  it('total é calculado no servidor (preço do banco, não do body)', async () => {
    const a = await cadastrarMilitar({ trigrama: 'AAA' });
    const p = await produtoCantina();
    const r = await api('/api/pedidos', {
      token: a.token,
      body: { itens: [{ produto_id: p.id, quantidade: 2, preco: 0.01 }], metodo: 'pix', total: 0.01 },
    });
    expect(r.status).toBe(201);
    expect(r.body.total).toBe(Math.round(p.preco * 2 * 100) / 100);
  });

  it('quantidade inválida/negativa => 400', async () => {
    const a = await cadastrarMilitar({ trigrama: 'AAA' });
    const p = await produtoCantina();
    for (const quantidade of [0, -1, 1.5, '2']) {
      const r = await api('/api/pedidos', { token: a.token, body: { itens: [{ produto_id: p.id, quantidade }], metodo: 'pix' } });
      expect(r.status, String(quantidade)).toBe(400);
    }
  });

  it('usuário desativado não compra', async () => {
    const sup = await loginSuper();
    const a = await cadastrarMilitar({ trigrama: 'AAA' });
    await api(`/api/usuarios/admin/${a.id}/desativar`, { method: 'PUT', token: sup.token });
    const r = await pedidoCantina(a.token, 'pix');
    // o userAuthMiddleware confere ativo=1 no banco: token de conta desativada deixa de valer (401;
    // o app desloga e o login seguinte explica "Conta desativada")
    expect(r.status).toBe(401);
  });

  it('visitante com acesso pausado => 403 acesso_bloqueado', async () => {
    const sup = await loginSuper();
    const v = await cadastrarVisitante({ trigrama: 'VIS' });
    expect((await pedidoCantina(v.token, 'pix')).status).toBe(201);
    await api(`/api/usuarios/admin/${v.id}/visitante`, { method: 'PUT', token: sup.token, body: { acesso_pausado: 1 } });
    const r = await pedidoCantina(v.token, 'pix');
    expect(r.status).toBe(403);
    expect(r.body.acesso_bloqueado).toBe(true);
  });
});

describe('fiado', () => {
  it('militar com permite_fiado (padrão) compra fiado na cantina e na loja', async () => {
    const sup = await loginSuper();
    const prod = await criarProdutoLoja(sup.token);
    const a = await cadastrarMilitar({ trigrama: 'AAA' });
    const c = await pedidoCantina(a.token, 'fiado');
    expect(c.status).toBe(201);
    expect(c.body.status).toBe('fiado');
    const l = await api('/api/loja/pedidos', { token: a.token, body: { itens: [{ produto_id: prod.id, quantidade: 1 }], metodo: 'fiado' } });
    expect(l.status).toBe(201);
    expect(l.body.status).toBe('fiado');
  });

  it('fiado sem login (loja) => 403; PIX sem login continua permitido', async () => {
    const sup = await loginSuper();
    const prod = await criarProdutoLoja(sup.token);
    const itens = [{ produto_id: prod.id, quantidade: 1 }];
    const fiado = await api('/api/loja/pedidos', { body: { nome_guerra: 'ANO', itens, metodo: 'fiado' } });
    expect(fiado.status).toBe(403);
    const n = await env.DB.prepare("SELECT COUNT(*) as n FROM loja_pedidos WHERE status = 'fiado'").first<{ n: number }>();
    expect(n!.n).toBe(0);
    const pix = await api('/api/loja/pedidos', { body: { nome_guerra: 'ANO', itens, metodo: 'pix' } });
    expect(pix.status).toBe(201);
    expect(pix.body.status).toBe('pendente');
  });

  it('pedido anônimo da loja não altera cliente que já existe', async () => {
    const sup = await loginSuper();
    const prod = await criarProdutoLoja(sup.token);
    await cadastrarMilitar({ trigrama: 'AAA' });
    const antes = await env.DB.prepare("SELECT whatsapp, visitante, esquadrao_origem FROM clientes WHERE nome_guerra = 'AAA'").first();
    const r = await api('/api/loja/pedidos', {
      body: { nome_guerra: 'aaa', whatsapp: '000', visitante: true, esquadrao_origem: 'X', itens: [{ produto_id: prod.id, quantidade: 1 }], metodo: 'pix' },
    });
    expect(r.status).toBe(201);
    const depois = await env.DB.prepare("SELECT whatsapp, visitante, esquadrao_origem FROM clientes WHERE nome_guerra = 'AAA'").first();
    expect(depois).toEqual(antes);
  });

  it('token inválido na loja => 401 (não cai para anônimo)', async () => {
    const sup = await loginSuper();
    const prod = await criarProdutoLoja(sup.token);
    const r = await api('/api/loja/pedidos', { token: 'lixo', body: { nome_guerra: 'ANO', itens: [{ produto_id: prod.id, quantidade: 1 }], metodo: 'pix' } });
    expect(r.status).toBe(401);
  });

  it('permite_fiado = 0 recusa fiado (cantina e loja) mas aceita PIX', async () => {
    const sup = await loginSuper();
    const prod = await criarProdutoLoja(sup.token);
    const a = await cadastrarMilitar({ trigrama: 'AAA' });
    const off = await api(`/api/usuarios/admin/${a.id}/fiado`, { method: 'PUT', token: sup.token, body: { permite_fiado: 0 } });
    expect(off.status).toBe(200);

    expect((await pedidoCantina(a.token, 'fiado')).status).toBe(403);
    const l = await api('/api/loja/pedidos', { token: a.token, body: { itens: [{ produto_id: prod.id, quantidade: 1 }], metodo: 'fiado' } });
    expect(l.status).toBe(403);
    expect((await pedidoCantina(a.token, 'pix')).status).toBe(201);

    const fiados = await env.DB.prepare("SELECT (SELECT COUNT(*) FROM pedidos WHERE status = 'fiado') + (SELECT COUNT(*) FROM loja_pedidos WHERE status = 'fiado') as n").first<{ n: number }>();
    expect(fiados!.n).toBe(0);
  });

  it('visitante nasce com permite_fiado = 0', async () => {
    const v = await cadastrarVisitante({ trigrama: 'VIS' });
    expect((await pedidoCantina(v.token, 'fiado')).status).toBe(403);
    expect((await pedidoCantina(v.token, 'pix')).status).toBe(201);
  });

  it('só admin muda permite_fiado (usuário => 401)', async () => {
    const a = await cadastrarMilitar({ trigrama: 'AAA' });
    const r = await api(`/api/usuarios/admin/${a.id}/fiado`, { method: 'PUT', token: a.token, body: { permite_fiado: 1 } });
    expect(r.status).toBe(401);
  });
});

describe('perfil', () => {
  it('PUT /me não altera campos sensíveis (categoria, permite_fiado, trigrama)', async () => {
    const a = await cadastrarMilitar({ trigrama: 'AAA', categoria: 'graduado' });
    const r = await api('/api/usuarios/me', {
      method: 'PUT', token: a.token,
      body: { whatsapp: '61988887777', categoria: 'oficial', permite_fiado: 1, trigrama: 'ZZZ', is_recepcionista: 1 },
    });
    expect(r.status).toBe(200);
    const u = await env.DB.prepare('SELECT trigrama, categoria, is_recepcionista, whatsapp FROM usuarios WHERE id = ?').bind(a.id).first();
    expect(u).toEqual({ trigrama: 'AAA', categoria: 'graduado', is_recepcionista: 0, whatsapp: '61988887777' });
  });

  it('GET /me não devolve senha_hash', async () => {
    const a = await cadastrarMilitar({ trigrama: 'AAA' });
    const r = await api('/api/usuarios/me', { token: a.token });
    expect(r.status).toBe(200);
    expect(r.body.senha_hash).toBeUndefined();
  });
});
