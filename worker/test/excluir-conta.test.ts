// Caso 4 — excluir a própria conta (LGPD): exige senha, não apaga dívida e, quando apaga, apaga tudo.
import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import { api, loginSuper, cadastrarMilitar, pedidoCantina, criarAssinante, criarProdutoLoja, enviarComprovante } from './helpers/fixtures';

const excluir = (token: string | null, body?: unknown) => api('/api/usuarios/me', { method: 'DELETE', token, body });

async function contar(sql: string, ...binds: unknown[]): Promise<number> {
  const r = await env.DB.prepare(sql).bind(...binds).first<{ n: number }>();
  return r!.n;
}

describe('DELETE /api/usuarios/me', () => {
  it('sem token => 401', async () => {
    expect((await excluir(null, { senha: 'x' })).status).toBe(401);
  });

  it('sem senha => 400 (com e sem body)', async () => {
    const u = await cadastrarMilitar({ trigrama: 'DEL' });
    expect((await excluir(u.token)).status).toBe(400);
    expect((await excluir(u.token, {})).status).toBe(400);
    expect(await contar('SELECT COUNT(*) as n FROM usuarios WHERE id = ?', u.id)).toBe(1);
  });

  it('senha errada => 403 e a conta continua', async () => {
    const u = await cadastrarMilitar({ trigrama: 'DEL' });
    const r = await excluir(u.token, { senha: 'senha-errada' });
    expect(r.status).toBe(403);
    expect(await contar('SELECT COUNT(*) as n FROM usuarios WHERE id = ?', u.id)).toBe(1);
  });

  it('senha errada repetida => 429 (rate limit)', async () => {
    const u = await cadastrarMilitar({ trigrama: 'DEL' });
    for (let i = 0; i < 5; i++) expect((await excluir(u.token, { senha: 'errada' })).status).toBe(403);
    expect((await excluir(u.token, { senha: u.senha })).status).toBe(429);
  });

  it('com dívida na cantina => 409 com as pendências, nada é apagado', async () => {
    const u = await cadastrarMilitar({ trigrama: 'DEL' });
    const p = await pedidoCantina(u.token, 'fiado');
    const r = await excluir(u.token, { senha: u.senha });
    expect(r.status).toBe(409);
    expect(r.body.pendencias.cantina).toBe(p.body.total);
    expect(await contar('SELECT COUNT(*) as n FROM usuarios WHERE id = ?', u.id)).toBe(1);
    expect(await contar('SELECT COUNT(*) as n FROM pedidos WHERE id = ?', p.body.pedido_id)).toBe(1);
  });

  it('com mensalidade do café pendente => 409', async () => {
    const sup = await loginSuper();
    const u = await cadastrarMilitar({ trigrama: 'DEL' });
    await criarAssinante(sup.token, 'DEL', { valor: 20 });
    const r = await excluir(u.token, { senha: u.senha });
    expect(r.status).toBe(409);
    expect(r.body.pendencias.cafe).toBe(20);
  });

  it('com pedido da loja em aberto (até PIX pendente) => 409', async () => {
    const sup = await loginSuper();
    const prod = await criarProdutoLoja(sup.token, { preco: 50 });
    const u = await cadastrarMilitar({ trigrama: 'DEL' });
    await api('/api/loja/pedidos', { token: u.token, body: { itens: [{ produto_id: prod.id, quantidade: 1 }], metodo: 'pix' } });
    const r = await excluir(u.token, { senha: u.senha });
    expect(r.status).toBe(409);
    expect(r.body.pendencias.loja).toBe(50);
  });

  it('sem dívida => 200 e some tudo: usuário, cliente, pedidos, café, loja, comprovantes, notificações', async () => {
    const sup = await loginSuper();
    const prod = await criarProdutoLoja(sup.token, { preco: 50 });
    const outro = await cadastrarMilitar({ trigrama: 'OUT' });
    const u = await cadastrarMilitar({ trigrama: 'DEL' });

    // histórico já quitado em todos os módulos
    const ped = await pedidoCantina(u.token, 'fiado');
    await enviarComprovante(u.token, 'cantina', ped.body.pedido_id);
    await api(`/api/pedidos/${ped.body.pedido_id}/pagar`, { method: 'PUT', token: sup.token });
    const lj = await api('/api/loja/pedidos', { token: u.token, body: { itens: [{ produto_id: prod.id, quantidade: 1 }], metodo: 'pix' } });
    await api(`/api/loja/admin/pedidos/${lj.body.pedido_id}/pagar`, { method: 'PUT', token: sup.token });
    const ass = await criarAssinante(sup.token, 'DEL');
    await api(`/api/cafe/admin/mensalidades/${ass.primeira_cobranca.id}/pagar`, { method: 'PUT', token: sup.token });
    // dados do outro usuário (não podem ser afetados)
    await pedidoCantina(outro.token, 'fiado');

    const cli = await env.DB.prepare("SELECT id FROM clientes WHERE nome_guerra = 'DEL'").first<{ id: string }>();
    expect(cli).not.toBeNull();
    expect(await contar("SELECT COUNT(*) as n FROM notificacoes WHERE trigrama = 'DEL'")).toBeGreaterThan(0);

    const r = await excluir(u.token, { senha: u.senha });
    expect(r.status, JSON.stringify(r.body)).toBe(200);

    expect(await contar('SELECT COUNT(*) as n FROM usuarios WHERE id = ?', u.id)).toBe(0);
    expect(await contar('SELECT COUNT(*) as n FROM clientes WHERE id = ?', cli!.id)).toBe(0);
    expect(await contar('SELECT COUNT(*) as n FROM pedidos WHERE cliente_id = ?', cli!.id)).toBe(0);
    expect(await contar('SELECT COUNT(*) as n FROM itens_pedido WHERE pedido_id = ?', ped.body.pedido_id)).toBe(0);
    expect(await contar('SELECT COUNT(*) as n FROM loja_pedidos WHERE cliente_id = ?', cli!.id)).toBe(0);
    expect(await contar('SELECT COUNT(*) as n FROM loja_parcelas WHERE pedido_id = ?', lj.body.pedido_id)).toBe(0);
    expect(await contar('SELECT COUNT(*) as n FROM loja_itens_pedido WHERE pedido_id = ?', lj.body.pedido_id)).toBe(0);
    expect(await contar('SELECT COUNT(*) as n FROM cafe_assinantes WHERE cliente_id = ?', cli!.id)).toBe(0);
    expect(await contar('SELECT COUNT(*) as n FROM cafe_pagamentos WHERE assinante_id = ?', ass.id)).toBe(0);
    expect(await contar("SELECT COUNT(*) as n FROM comprovantes WHERE trigrama = 'DEL'")).toBe(0);
    expect(await contar("SELECT COUNT(*) as n FROM notificacoes WHERE trigrama = 'DEL'")).toBe(0);
    // auditoria registra a exclusão
    expect(await contar("SELECT COUNT(*) as n FROM audit_log WHERE acao = 'excluir_propria_conta'")).toBe(1);

    // o outro usuário não foi afetado
    expect(await contar("SELECT COUNT(*) as n FROM usuarios WHERE trigrama = 'OUT'")).toBe(1);
    expect(await contar("SELECT COUNT(*) as n FROM pedidos p JOIN clientes c ON c.id = p.cliente_id WHERE c.nome_guerra = 'OUT'")).toBe(1);

    // a conta deixou de existir: login falha e o token antigo não acha mais o usuário
    expect((await api('/api/usuarios/login', { body: { email: u.email, senha: u.senha } })).status).toBe(401);
    // (o userAuthMiddleware recarrega o usuário a cada requisição: sem linha no banco => 401)
    expect((await api('/api/usuarios/me', { token: u.token })).status).toBe(401);

    // o trigrama fica livre para um novo cadastro
    const novo = await api('/api/usuarios/cadastro', {
      body: { email: 'novo@teste.local', senha: 'senha123', trigrama: 'DEL', saram: '7777777', whatsapp: '61', categoria: 'graduado', aceite_lgpd: true },
    });
    expect(novo.status).toBe(201);
  });
});
