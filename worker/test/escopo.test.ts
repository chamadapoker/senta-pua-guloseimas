// Caso 2 — admin com escopo cafe_graduado: só o café da sala dos graduados (OWASP A01, menor privilégio).
import { env } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  api, loginSuper, criarAdmin, cadastrarMilitar, criarAssinante, pedidoCantina, enviarComprovante,
  type Usuario,
} from './helpers/fixtures';

type Cenario = {
  superToken: string;
  esc: { token: string; id: string; senha: string };
  grad: Usuario;
  ofi: Usuario;
  assGrad: Awaited<ReturnType<typeof criarAssinante>>;
  assOfi: Awaited<ReturnType<typeof criarAssinante>>;
};

let s: Cenario;

beforeEach(async () => {
  const sup = await loginSuper();
  const esc = await criarAdmin(sup.token, { escopo: 'cafe_graduado' });
  const grad = await cadastrarMilitar({ trigrama: 'GRD', categoria: 'graduado' });
  const ofi = await cadastrarMilitar({ trigrama: 'OFC', categoria: 'oficial' });
  const assGrad = await criarAssinante(sup.token, 'GRD', { valor: 20 });
  const assOfi = await criarAssinante(sup.token, 'OFC', { valor: 30 });
  s = { superToken: sup.token, esc, grad, ofi, assGrad, assOfi };
});

describe('escopo cafe_graduado: rotas fora do escopo => 403 escopo_negado', () => {
  const NEGADAS: [string, string, unknown?][] = [
    ['GET', '/api/produtos/todos'],                 // cantina
    ['POST', '/api/produtos', { nome: 'x', preco: 1 }],
    ['GET', '/api/pedidos'],
    ['GET', '/api/loja/admin/produtos'],            // loja
    ['GET', '/api/loja/admin/pedidos'],
    ['GET', '/api/admin/painel'],                   // painel
    ['GET', '/api/admin/stats'],
    ['GET', '/api/admin/caixa-consolidado'],
    ['GET', '/api/admins'],                         // admins
    ['POST', '/api/admins', { email: 'a@b.c', senha: '12345678', nome: 'x' }],
    ['GET', '/api/auditoria'],                      // auditoria
    ['GET', '/api/usuarios/admin/lista'],           // usuários
    ['PUT', '/api/usuarios/admin/1/categoria', { categoria: 'oficial' }],
    ['GET', '/api/clientes'],
    ['GET', '/api/cafe/devedores'],                 // café, mas fora da área /admin/ da sala
    ['GET', '/api/ximboca/eventos'],
    ['GET', '/api/inventario'],
    ['POST', '/api/notificacoes/admin/enviar', { titulo: 'x', mensagem: 'y' }],
  ];

  it.each(NEGADAS)('%s %s', async (method, path, body) => {
    const r = await api(path, { method, token: s.esc.token, body });
    expect(r.status).toBe(403);
    expect(r.body.escopo_negado).toBe(true);
  });

  it('as mesmas rotas funcionam para o super admin', async () => {
    for (const [method, path] of NEGADAS.filter(([m]) => m === 'GET')) {
      const r = await api(path, { method, token: s.superToken });
      expect(r.status, path).toBe(200);
    }
  });

  it('o 403 do escopo não altera nada (POST /api/admins não cria)', async () => {
    const antes = await env.DB.prepare('SELECT COUNT(*) as n FROM admins').first<{ n: number }>();
    await api('/api/admins', { token: s.esc.token, body: { email: 'z@z.z', senha: '12345678', nome: 'z' } });
    const depois = await env.DB.prepare('SELECT COUNT(*) as n FROM admins').first<{ n: number }>();
    expect(depois!.n).toBe(antes!.n);
  });
});

describe('escopo cafe_graduado: o que ele PODE fazer', () => {
  it('GET /api/auth/me mostra o escopo', async () => {
    const r = await api('/api/auth/me', { token: s.esc.token });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ escopo: 'cafe_graduado', role: 'admin' });
  });

  it('troca a própria senha', async () => {
    const r = await api('/api/admins/me/senha', { method: 'PUT', token: s.esc.token, body: { senha_atual: s.esc.senha, senha: 'NovaSenha123' } });
    expect(r.status).toBe(200);
  });

  it('lista assinantes: só os graduados (sem ?tipo e com ?tipo=graduado)', async () => {
    for (const q of ['', '?tipo=graduado']) {
      const r = await api(`/api/cafe/admin/assinantes${q}`, { token: s.esc.token });
      expect(r.status).toBe(200);
      expect(r.body.map((a: any) => a.id)).toEqual([s.assGrad.id]);
    }
  });

  it('?tipo=oficial => 403 em todas as listagens do café', async () => {
    for (const rota of ['assinantes', 'mensalidades', 'insumos', 'stats', 'despesas', 'saldo']) {
      const r = await api(`/api/cafe/admin/${rota}?tipo=oficial`, { token: s.esc.token });
      expect(r.status, rota).toBe(403);
      expect(r.body.escopo_negado, rota).toBe(true);
    }
  });

  it('mensalidades: só da sala dos graduados', async () => {
    const r = await api('/api/cafe/admin/mensalidades', { token: s.esc.token });
    expect(r.status).toBe(200);
    expect(r.body.length).toBe(1);
    expect(r.body[0]).toMatchObject({ id: s.assGrad.primeira_cobranca.id, tipo: 'graduado' });
  });

  it('gerar mensalidades com tipo=oficial => 403; sem tipo => só graduados', async () => {
    expect((await api('/api/cafe/admin/gerar-mensalidades', { token: s.esc.token, body: { referencia: '2030-01', tipo: 'oficial' } })).status).toBe(403);
    const r = await api('/api/cafe/admin/gerar-mensalidades', { token: s.esc.token, body: { referencia: '2030-01' } });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ criados: 1, total: 1 });
    const ofi = await env.DB.prepare("SELECT COUNT(*) as n FROM cafe_pagamentos WHERE assinante_id = ? AND referencia = '2030-01'").bind(s.assOfi.id).first<{ n: number }>();
    expect(ofi!.n).toBe(0);
  });

  it('insumos e despesas: criar na sala oficial => 403; na própria sala => 201', async () => {
    expect((await api('/api/cafe/admin/insumos', { token: s.esc.token, body: { nome: 'Pó', tipo: 'oficial' } })).status).toBe(403);
    const ins = await api('/api/cafe/admin/insumos', { token: s.esc.token, body: { nome: 'Pó' } });
    expect(ins.status).toBe(201);
    expect(ins.body.tipo).toBe('graduado');

    expect((await api('/api/cafe/admin/despesas', { token: s.esc.token, body: { tipo: 'oficial', descricao: 'x', valor: 10 } })).status).toBe(403);
    const desp = await api('/api/cafe/admin/despesas', { token: s.esc.token, body: { descricao: 'Açúcar', valor: 10 } });
    expect(desp.status).toBe(201);
    expect(desp.body.tipo).toBe('graduado');
  });

  it('adicionar assinante oficial => 403 (sala da categoria do usuário)', async () => {
    await env.DB.prepare('UPDATE cafe_assinantes SET ativo = 0 WHERE id = ?').bind(s.assOfi.id).run();
    const r = await api('/api/cafe/admin/assinantes', { token: s.esc.token, body: { nome_guerra: 'OFC', valor: 30 } });
    expect(r.status).toBe(403);
    expect(r.body.escopo_negado).toBe(true);
  });
});

describe('escopo cafe_graduado: recurso por id da sala dos oficiais => 404 (não revela que existe)', () => {
  it('assinante oficial', async () => {
    const id = s.assOfi.id;
    const casos: [string, string, unknown?][] = [
      ['GET', `/api/cafe/admin/assinantes/${id}/pagamentos`],
      ['PUT', `/api/cafe/admin/assinantes/${id}`, { valor: 1 }],
      ['PUT', `/api/cafe/admin/assinantes/${id}/desativar`],
      ['POST', `/api/cafe/admin/assinantes/${id}/cobrar`, { referencia: '2031-01' }],
      ['DELETE', `/api/cafe/admin/assinantes/${id}`],
    ];
    for (const [method, path, body] of casos) {
      const r = await api(path, { method, token: s.esc.token, body });
      expect(r.status, `${method} ${path}`).toBe(404);
    }
    const a = await env.DB.prepare('SELECT ativo, valor FROM cafe_assinantes WHERE id = ?').bind(id).first<{ ativo: number; valor: number }>();
    expect(a).toEqual({ ativo: 1, valor: 30 }); // nada mudou
  });

  it('id inexistente responde igual ao id de outra sala (404)', async () => {
    const r = await api('/api/cafe/admin/assinantes/nao-existe/pagamentos', { token: s.esc.token });
    expect(r.status).toBe(404);
  });

  it('pagar mensalidade oficial => 404; graduada => 200', async () => {
    const ofi = await api(`/api/cafe/admin/mensalidades/${s.assOfi.primeira_cobranca.id}/pagar`, { method: 'PUT', token: s.esc.token });
    expect(ofi.status).toBe(404);
    const st = await env.DB.prepare('SELECT status FROM cafe_pagamentos WHERE id = ?').bind(s.assOfi.primeira_cobranca.id).first<{ status: string }>();
    expect(st!.status).toBe('pendente');

    const grad = await api(`/api/cafe/admin/mensalidades/${s.assGrad.primeira_cobranca.id}/pagar`, { method: 'PUT', token: s.esc.token });
    expect(grad.status).toBe(200);
    expect(grad.body.status).toBe('pago');
  });

  it('insumo e despesa da sala oficial => 404', async () => {
    const ins = await api('/api/cafe/admin/insumos', { token: s.superToken, body: { nome: 'Pó oficial', tipo: 'oficial' } });
    const desp = await api('/api/cafe/admin/despesas', { token: s.superToken, body: { tipo: 'oficial', descricao: 'x', valor: 5 } });
    expect((await api(`/api/cafe/admin/insumos/${ins.body.id}`, { method: 'PUT', token: s.esc.token, body: { estoque: 0 } })).status).toBe(404);
    expect((await api(`/api/cafe/admin/insumos/${ins.body.id}`, { method: 'DELETE', token: s.esc.token })).status).toBe(404);
    expect((await api(`/api/cafe/admin/despesas/${desp.body.id}`, { method: 'DELETE', token: s.esc.token })).status).toBe(404);
  });

  it('assinante da própria sala: editar/cobrar funcionam', async () => {
    const e = await api(`/api/cafe/admin/assinantes/${s.assGrad.id}`, { method: 'PUT', token: s.esc.token, body: { valor: 22 } });
    expect(e.status).toBe(200);
    expect(e.body.valor).toBe(22);
    const c = await api(`/api/cafe/admin/assinantes/${s.assGrad.id}/cobrar`, { token: s.esc.token, body: { referencia: '2031-01' } });
    expect(c.status).toBe(201);
  });
});

describe('escopo cafe_graduado: configurações', () => {
  it('altera só as chaves da sala', async () => {
    const r = await api('/api/config', { method: 'PUT', token: s.esc.token, body: { cafe_valor_graduado_mensal: '30,50', nome_cafe_graduados: 'Café dos Sgts' } });
    expect(r.status).toBe(200);
    const cfg = await api('/api/config');
    expect(cfg.body.cafe_valor_graduado_mensal).toBe('30.5');
    expect(cfg.body.nome_cafe_graduados).toBe('Café dos Sgts');
  });

  it('qualquer chave fora da sala => 403 e NADA é gravado (nem as chaves permitidas)', async () => {
    const r = await api('/api/config', {
      method: 'PUT', token: s.esc.token,
      body: { cafe_valor_graduado_mensal: '99', nome_sala_oficiais: 'Hackeada', pix_cafe_oficial_chave: 'x' },
    });
    expect(r.status).toBe(403);
    expect(r.body.escopo_negado).toBe(true);
    expect(r.body.chaves_negadas).toEqual(expect.arrayContaining(['nome_sala_oficiais', 'pix_cafe_oficial_chave']));
    const cfg = await api('/api/config');
    expect(cfg.body.nome_sala_oficiais).toBe('Sala dos Oficiais');
    expect(cfg.body.cafe_valor_graduado_mensal).toBeUndefined();
    expect(cfg.body.pix_cafe_oficial_chave).toBeUndefined();
  });

  it('super admin altera qualquer chave', async () => {
    const r = await api('/api/config', { method: 'PUT', token: s.superToken, body: { nome_sala_oficiais: 'Sala Nova', loja_max_parcelas: '3' } });
    expect(r.status).toBe(200);
    const cfg = await api('/api/config');
    expect(cfg.body).toMatchObject({ nome_sala_oficiais: 'Sala Nova', loja_max_parcelas: '3' });
  });

  it('config sem token => 401', async () => {
    expect((await api('/api/config', { method: 'PUT', body: { nome_sala_oficiais: 'x' } })).status).toBe(401);
  });
});

describe('escopo cafe_graduado: comprovantes só do café dos graduados', () => {
  let compGrad: string, compOfi: string, compCantina: string;

  beforeEach(async () => {
    const cg = await enviarComprovante(s.grad.token, 'cafe', s.assGrad.primeira_cobranca.id);
    const co = await enviarComprovante(s.ofi.token, 'cafe', s.assOfi.primeira_cobranca.id);
    const ped = await pedidoCantina(s.grad.token, 'pix');
    const cc = await enviarComprovante(s.grad.token, 'cantina', ped.body.pedido_id);
    for (const r of [cg, co, cc]) expect(r.status, JSON.stringify(r.body)).toBe(201);
    compGrad = cg.body.id; compOfi = co.body.id; compCantina = cc.body.id;
  });

  it('lista e contador do escopo: só o do café graduado', async () => {
    const l = await api('/api/comprovantes', { token: s.esc.token });
    expect(l.status).toBe(200);
    expect(l.body.items.map((c: any) => c.id)).toEqual([compGrad]);
    expect(l.body.total).toBe(1);
    // filtro por origem não fura o escopo
    const lc = await api('/api/comprovantes?origem=cantina', { token: s.esc.token });
    expect(lc.body.items).toEqual([]);
    const n = await api('/api/comprovantes/pendentes/count', { token: s.esc.token });
    expect(n.body.total).toBe(1);
  });

  it('super admin vê todos', async () => {
    const l = await api('/api/comprovantes', { token: s.superToken });
    expect(l.body.items.map((c: any) => c.id).sort()).toEqual([compGrad, compOfi, compCantina].sort());
    expect((await api('/api/comprovantes/pendentes/count', { token: s.superToken })).body.total).toBe(3);
  });

  it('aprovar/rejeitar comprovante fora do escopo => 404 e nada muda', async () => {
    for (const id of [compOfi, compCantina]) {
      expect((await api(`/api/comprovantes/${id}/aprovar`, { method: 'PUT', token: s.esc.token })).status).toBe(404);
      expect((await api(`/api/comprovantes/${id}/rejeitar`, { method: 'PUT', token: s.esc.token, body: { motivo: 'x' } })).status).toBe(404);
    }
    const st = await env.DB.prepare('SELECT status FROM cafe_pagamentos WHERE id = ?').bind(s.assOfi.primeira_cobranca.id).first<{ status: string }>();
    expect(st!.status).toBe('pendente');
    const comps = await env.DB.prepare("SELECT COUNT(*) as n FROM comprovantes WHERE status = 'aguardando'").first<{ n: number }>();
    expect(comps!.n).toBe(3);
  });

  it('aprovar o do café graduado => 200 e a mensalidade fica paga', async () => {
    const r = await api(`/api/comprovantes/${compGrad}/aprovar`, { method: 'PUT', token: s.esc.token });
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('aprovado');
    const st = await env.DB.prepare('SELECT status FROM cafe_pagamentos WHERE id = ?').bind(s.assGrad.primeira_cobranca.id).first<{ status: string }>();
    expect(st!.status).toBe('pago');
  });

  it('buscar usuário por trigrama (permitido no escopo)', async () => {
    const r = await api('/api/usuarios/admin/por-trigrama/GRD', { token: s.esc.token });
    expect(r.status).toBe(200);
    expect(r.body.trigrama).toBe('GRD');
  });
});

describe('super admin continua vendo tudo', () => {
  it('assinantes das duas salas, auditoria, admins e painel', async () => {
    const a = await api('/api/cafe/admin/assinantes', { token: s.superToken });
    expect(a.body.map((x: any) => x.id).sort()).toEqual([s.assGrad.id, s.assOfi.id].sort());
    expect((await api('/api/cafe/admin/assinantes?tipo=oficial', { token: s.superToken })).body.map((x: any) => x.id)).toEqual([s.assOfi.id]);
    expect((await api(`/api/cafe/admin/assinantes/${s.assOfi.id}/pagamentos`, { token: s.superToken })).status).toBe(200);
    for (const rota of ['/api/auditoria', '/api/admins', '/api/admin/painel', '/api/usuarios/admin/lista']) {
      expect((await api(rota, { token: s.superToken })).status, rota).toBe(200);
    }
  });

  it('não dá para se auto-restringir com escopo (evita auto-lockout)', async () => {
    const sup = await loginSuper();
    const r = await api(`/api/admins/${sup.id}`, { method: 'PUT', token: sup.token, body: { escopo: 'cafe_graduado' } });
    expect(r.status).toBe(400);
  });

  it('escopo inválido é recusado na criação', async () => {
    const r = await api('/api/admins', { token: s.superToken, body: { email: 'e@e.e', senha: '12345678', nome: 'e', escopo: 'tudo' } });
    expect(r.status).toBe(400);
  });

  it('admin com escopo nunca vira super_admin', async () => {
    const r = await api('/api/admins', { token: s.superToken, body: { email: 'f@f.f', senha: '12345678', nome: 'f', role: 'super_admin', escopo: 'cafe_graduado' } });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ role: 'admin', escopo: 'cafe_graduado' });
  });

  it('escopo desconhecido gravado no banco não libera nada', async () => {
    await env.DB.prepare("UPDATE admins SET escopo = 'xyz' WHERE id = ?").bind(s.esc.id).run();
    expect((await api('/api/cafe/admin/assinantes', { token: s.esc.token })).status).toBe(403);
    expect((await api('/api/auth/me', { token: s.esc.token })).status).toBe(403);
  });
});
