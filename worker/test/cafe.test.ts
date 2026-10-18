// Caso 7 — café: sala segue a categoria, praça não assina, anuidade de 12 meses, troca de categoria.
import { env } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import { api, loginSuper, criarAdmin, cadastrarMilitar, cadastrarVisitante, criarAssinante, mesBrasilia, somarMesesYM } from './helpers/fixtures';

let superToken: string;

beforeEach(async () => {
  superToken = (await loginSuper()).token;
});

const assinar = (body: Record<string, unknown>, token = superToken) => api('/api/cafe/admin/assinantes', { token, body });

describe('sala segue a categoria do usuário', () => {
  it('oficial vai para a sala dos oficiais mesmo com tipo=graduado no body', async () => {
    await cadastrarMilitar({ trigrama: 'OFA', categoria: 'oficial' });
    const r = await assinar({ nome_guerra: 'OFA', tipo: 'graduado', valor: 30 });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ tipo: 'oficial', sala: 'oficial', plano: 'mensal', valor: 30 });
  });

  it('graduado vai para a sala dos graduados mesmo com tipo=oficial no body', async () => {
    await cadastrarMilitar({ trigrama: 'GRA', categoria: 'graduado' });
    const r = await assinar({ nome_guerra: 'GRA', tipo: 'oficial', valor: 20 });
    expect(r.status).toBe(201);
    expect(r.body.tipo).toBe('graduado');
  });

  it('sem conta: vale o tipo do body; sem tipo e sem conta => 400', async () => {
    const r = await assinar({ nome_guerra: 'SEM', tipo: 'oficial', valor: 20 });
    expect(r.status).toBe(201);
    expect(r.body.tipo).toBe('oficial');
    expect((await assinar({ nome_guerra: 'SEM2', valor: 20 })).status).toBe(400);
  });

  it('mensal: primeira cobrança no mês atual (Brasília)', async () => {
    await cadastrarMilitar({ trigrama: 'GRA', categoria: 'graduado' });
    const r = await assinar({ nome_guerra: 'GRA', valor: 20 });
    expect(r.body.primeira_cobranca).toMatchObject({ referencia: mesBrasilia(), periodo_fim: null, valor: 20, status: 'pendente' });
  });

  it('valor vazio usa o padrão da sala+plano da config; sem padrão => 400', async () => {
    await cadastrarMilitar({ trigrama: 'GRA', categoria: 'graduado' });
    expect((await assinar({ nome_guerra: 'GRA' })).status).toBe(400);
    await api('/api/config', { method: 'PUT', token: superToken, body: { cafe_valor_graduado_mensal: '18,50' } });
    const r = await assinar({ nome_guerra: 'GRA' });
    expect(r.status).toBe(201);
    expect(r.body.valor).toBe(18.5);
  });

  it('assinatura ativa duplicada => 400', async () => {
    await cadastrarMilitar({ trigrama: 'GRA', categoria: 'graduado' });
    expect((await assinar({ nome_guerra: 'GRA', valor: 20 })).status).toBe(201);
    expect((await assinar({ nome_guerra: 'GRA', valor: 20 })).status).toBe(400);
  });

  it('editar assinante com conta: tipo do body é ignorado (segue a categoria)', async () => {
    await cadastrarMilitar({ trigrama: 'GRA', categoria: 'graduado' });
    const a = await criarAssinante(superToken, 'GRA');
    const r = await api(`/api/cafe/admin/assinantes/${a.id}`, { method: 'PUT', token: superToken, body: { tipo: 'oficial', valor: 21 } });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ tipo: 'graduado', valor: 21 });
  });

  it('sem token / token de usuário => 401', async () => {
    const u = await cadastrarMilitar({ trigrama: 'GRA', categoria: 'graduado' });
    expect((await api('/api/cafe/admin/assinantes', { body: { nome_guerra: 'GRA', valor: 20 } })).status).toBe(401);
    expect((await api('/api/cafe/admin/assinantes', { token: u.token, body: { nome_guerra: 'GRA', valor: 20 } })).status).toBe(401);
    expect((await env.DB.prepare('SELECT COUNT(*) as n FROM cafe_assinantes').first<{ n: number }>())!.n).toBe(0);
  });
});

describe('praça não participa', () => {
  it('assinar praça => 409 (super admin e admin com escopo)', async () => {
    await cadastrarMilitar({ trigrama: 'PRA', categoria: 'praca' });
    const esc = await criarAdmin(superToken, { escopo: 'cafe_graduado' });
    expect((await assinar({ nome_guerra: 'PRA', tipo: 'graduado', valor: 20 })).status).toBe(409);
    expect((await assinar({ nome_guerra: 'PRA', valor: 20 }, esc.token)).status).toBe(409);
    expect((await env.DB.prepare('SELECT COUNT(*) as n FROM cafe_assinantes').first<{ n: number }>())!.n).toBe(0);
  });

  it('/me/cafe da praça: sem sala', async () => {
    const u = await cadastrarMilitar({ trigrama: 'PRA', categoria: 'praca' });
    const r = await api('/api/usuarios/me/cafe', { token: u.token });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ tem_assinatura: false, sem_sala: true, sala: null });
  });
});

describe('plano anual', () => {
  it('cria anuidade com periodo_fim = início + 11 meses', async () => {
    await cadastrarMilitar({ trigrama: 'ANU', categoria: 'oficial' });
    const mes = mesBrasilia();
    const r = await assinar({ nome_guerra: 'ANU', plano: 'anual', valor: 240 });
    expect(r.status).toBe(201);
    expect(r.body.plano).toBe('anual');
    expect(r.body.primeira_cobranca).toMatchObject({ referencia: mes, periodo_fim: somarMesesYM(mes, 11), valor: 240 });
    const pags = await env.DB.prepare('SELECT referencia, periodo_fim FROM cafe_pagamentos WHERE assinante_id = ?').bind(r.body.id).all();
    expect(pags.results).toEqual([{ referencia: mes, periodo_fim: somarMesesYM(mes, 11) }]);
  });

  it('cobrar anuidade de novo começa no mês seguinte ao fim da cobertura; mesma referência => 409', async () => {
    await cadastrarMilitar({ trigrama: 'ANU', categoria: 'oficial' });
    const mes = mesBrasilia();
    const a = await criarAssinante(superToken, 'ANU', { plano: 'anual', valor: 240 });
    const r = await api(`/api/cafe/admin/assinantes/${a.id}/cobrar`, { token: superToken, body: { plano: 'anual' } });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ referencia: somarMesesYM(mes, 12), periodo_fim: somarMesesYM(mes, 23) });
    const dup = await api(`/api/cafe/admin/assinantes/${a.id}/cobrar`, { token: superToken, body: { plano: 'anual', referencia: mes } });
    expect(dup.status).toBe(409);
  });

  it('virada de ano: início em novembro => fim em outubro do ano seguinte', async () => {
    await cadastrarMilitar({ trigrama: 'ANU', categoria: 'oficial' });
    const a = await criarAssinante(superToken, 'ANU', { plano: 'anual', valor: 240 });
    const r = await api(`/api/cafe/admin/assinantes/${a.id}/cobrar`, { token: superToken, body: { plano: 'anual', referencia: '2030-11' } });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ referencia: '2030-11', periodo_fim: '2031-10' });
  });

  it('/me/cafe do anual pago mostra valido_ate = fim da cobertura', async () => {
    const u = await cadastrarMilitar({ trigrama: 'ANU', categoria: 'oficial' });
    const a = await criarAssinante(superToken, 'ANU', { plano: 'anual', valor: 240 });
    await api(`/api/cafe/admin/mensalidades/${a.primeira_cobranca.id}/pagar`, { method: 'PUT', token: superToken });
    const r = await api('/api/usuarios/me/cafe', { token: u.token });
    expect(r.body).toMatchObject({ plano: 'anual', mes_atual_pago: true, valido_ate: somarMesesYM(mesBrasilia(), 11) });
  });

  it('gerar mensalidades ignora assinantes anuais', async () => {
    await cadastrarMilitar({ trigrama: 'ANU', categoria: 'oficial' });
    await cadastrarMilitar({ trigrama: 'MEN', categoria: 'oficial' });
    await criarAssinante(superToken, 'ANU', { plano: 'anual', valor: 240 });
    await criarAssinante(superToken, 'MEN', { valor: 20 });
    const r = await api('/api/cafe/admin/gerar-mensalidades', { token: superToken, body: { referencia: '2031-05' } });
    expect(r.body).toEqual({ criados: 1, total: 1 });
    // idempotente
    expect((await api('/api/cafe/admin/gerar-mensalidades', { token: superToken, body: { referencia: '2031-05' } })).body.criados).toBe(0);
  });
});

describe('troca de categoria move/desativa a assinatura', () => {
  it('graduado -> oficial: assinatura muda de sala', async () => {
    const u = await cadastrarMilitar({ trigrama: 'TRO', categoria: 'graduado' });
    const a = await criarAssinante(superToken, 'TRO');
    expect(a.tipo).toBe('graduado');
    const r = await api(`/api/usuarios/admin/${u.id}/categoria`, { method: 'PUT', token: superToken, body: { categoria: 'oficial' } });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ categoria: 'oficial', sala_cafe: 'oficiais', cafe_movido: true, cafe_desativado: false, cafe_tipo: 'oficial' });
    const ass = await env.DB.prepare('SELECT tipo, ativo FROM cafe_assinantes WHERE id = ?').bind(a.id).first();
    expect(ass).toEqual({ tipo: 'oficial', ativo: 1 });
    const audit = await env.DB.prepare("SELECT COUNT(*) as n FROM audit_log WHERE acao = 'mover_assinante_cafe_sala'").first<{ n: number }>();
    expect(audit!.n).toBe(1);
  });

  it('-> praça: assinatura desativada e não pode ser reativada (409)', async () => {
    const u = await cadastrarMilitar({ trigrama: 'TRO', categoria: 'oficial' });
    const a = await criarAssinante(superToken, 'TRO');
    const r = await api(`/api/usuarios/admin/${u.id}/categoria`, { method: 'PUT', token: superToken, body: { categoria: 'praca' } });
    expect(r.body).toMatchObject({ categoria: 'praca', sala_cafe: null, cafe_desativado: true, cafe_tipo: null });
    const ass = await env.DB.prepare('SELECT ativo FROM cafe_assinantes WHERE id = ?').bind(a.id).first<{ ativo: number }>();
    expect(ass!.ativo).toBe(0);
    const re = await api(`/api/cafe/admin/assinantes/${a.id}`, { method: 'PUT', token: superToken, body: { ativo: 1 } });
    expect(re.status).toBe(409);
    expect((await env.DB.prepare('SELECT ativo FROM cafe_assinantes WHERE id = ?').bind(a.id).first<{ ativo: number }>())!.ativo).toBe(0);
  });

  it('mesma sala: nada muda; sem assinatura: cafe_tipo null', async () => {
    const u = await cadastrarMilitar({ trigrama: 'TRO', categoria: 'graduado' });
    const r1 = await api(`/api/usuarios/admin/${u.id}/categoria`, { method: 'PUT', token: superToken, body: { categoria: 'oficial' } });
    expect(r1.body).toMatchObject({ cafe_movido: false, cafe_desativado: false, cafe_tipo: null });
    await criarAssinante(superToken, 'TRO');
    const r2 = await api(`/api/usuarios/admin/${u.id}/categoria`, { method: 'PUT', token: superToken, body: { categoria: 'oficial' } });
    expect(r2.body).toMatchObject({ cafe_movido: false, cafe_tipo: 'oficial' });
  });

  it('categoria inválida => 400; usuário inexistente => 404; usuário comum => 401', async () => {
    const u = await cadastrarMilitar({ trigrama: 'TRO', categoria: 'graduado' });
    expect((await api(`/api/usuarios/admin/${u.id}/categoria`, { method: 'PUT', token: superToken, body: { categoria: 'general' } })).status).toBe(400);
    expect((await api('/api/usuarios/admin/99999/categoria', { method: 'PUT', token: superToken, body: { categoria: 'oficial' } })).status).toBe(404);
    expect((await api(`/api/usuarios/admin/${u.id}/categoria`, { method: 'PUT', token: u.token, body: { categoria: 'oficial' } })).status).toBe(401);
  });

  it('o militar vê a sala nova no /me/cafe', async () => {
    const u = await cadastrarMilitar({ trigrama: 'TRO', categoria: 'graduado' });
    await criarAssinante(superToken, 'TRO');
    await api(`/api/usuarios/admin/${u.id}/categoria`, { method: 'PUT', token: superToken, body: { categoria: 'oficial' } });
    const r = await api('/api/usuarios/me/cafe', { token: u.token });
    expect(r.body).toMatchObject({ tem_assinatura: true, sala: 'oficial' });
  });
});

describe('visitante', () => {
  it('visitante graduado pode assinar o café da sala dele', async () => {
    await cadastrarVisitante({ trigrama: 'VIS', categoria: 'graduado' });
    const r = await assinar({ nome_guerra: 'VIS', valor: 20 });
    expect(r.status).toBe(201);
    expect(r.body.tipo).toBe('graduado');
  });
});
