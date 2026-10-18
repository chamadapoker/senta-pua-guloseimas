// Caso 9 — cron (handler scheduled): roda o handler real com a data simulada (vi.setSystemTime só
// no Date do JS; o SQLite continua com a hora real). Verifica que nada falha e que nada duplica.
import { env, createExecutionContext, createScheduledController, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import worker from '../src/index';
import { api, loginSuper, cadastrarMilitar, criarAssinante, pedidoCantina, somarMesesYM } from './helpers/fixtures';

async function rodarCron(quandoUtc: string) {
  vi.setSystemTime(new Date(quandoUtc));
  const ctrl = createScheduledController({ scheduledTime: new Date(quandoUtc), cron: '0 3 * * *' });
  const ctx = createExecutionContext();
  // não pode lançar
  // o handler tipa o 1º argumento como ScheduledEvent (legado); em module workers o runtime passa um ScheduledController
  await worker.scheduled(ctrl as unknown as ScheduledEvent, env, ctx);
  await waitOnExecutionContext(ctx);
  vi.useRealTimers();
  vi.useFakeTimers({ toFake: ['Date'] });
}

async function contar(sql: string, ...binds: unknown[]): Promise<number> {
  return (await env.DB.prepare(sql).bind(...binds).first<{ n: number }>())!.n;
}

/** Nenhuma rotina registrou falha na auditoria (o handler engole erros e grava 'cron_falhou'). */
async function semFalhas() {
  const { results } = await env.DB.prepare("SELECT entidade, dados_depois FROM audit_log WHERE acao = 'cron_falhou'").all();
  expect(results, JSON.stringify(results)).toEqual([]);
}

let superToken: string;

beforeEach(async () => {
  // fixtures criadas com a data real
  superToken = (await loginSuper()).token;
  vi.useFakeTimers({ toFake: ['Date'] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('cron: dia de cobrança (dia 1 em Brasília)', () => {
  it('banco vazio: nenhuma rotina falha', async () => {
    await rodarCron('2031-03-01T03:00:00Z');
    await semFalhas();
  });

  it('gera a mensalidade do mês uma única vez (rodando duas vezes) e notifica', async () => {
    await cadastrarMilitar({ trigrama: 'MEN', categoria: 'graduado' });
    const a = await criarAssinante(superToken, 'MEN', { valor: 20 });

    await rodarCron('2031-03-01T03:00:00Z');
    await rodarCron('2031-03-01T03:05:00Z');
    await semFalhas();

    expect(await contar("SELECT COUNT(*) as n FROM cafe_pagamentos WHERE assinante_id = ? AND referencia = '2031-03'", a.id)).toBe(1);
    expect(await contar("SELECT COUNT(*) as n FROM notificacoes WHERE trigrama = 'MEN' AND titulo = 'MENSALIDADE CAFÉ'")).toBe(1);
    expect(await contar("SELECT COUNT(*) as n FROM audit_log WHERE acao = 'gerar_cobrancas_auto'")).toBeGreaterThanOrEqual(1);
  });

  it('00:00 de Brasília (03:00 UTC) já é o dia 1; 02:59 UTC ainda é o último dia do mês anterior', async () => {
    await cadastrarMilitar({ trigrama: 'MEN', categoria: 'graduado' });
    const a = await criarAssinante(superToken, 'MEN', { valor: 20 });
    await rodarCron('2031-04-01T02:59:00Z'); // 31/03 23:59 em Brasília: dia 31, não cobra
    expect(await contar("SELECT COUNT(*) as n FROM cafe_pagamentos WHERE assinante_id = ? AND referencia IN ('2031-03','2031-04')", a.id)).toBe(0);
    await rodarCron('2031-04-01T03:00:00Z');
    expect(await contar("SELECT COUNT(*) as n FROM cafe_pagamentos WHERE assinante_id = ? AND referencia = '2031-04'", a.id)).toBe(1);
    await semFalhas();
  });

  it('dias 2..5 recuperam um dia 1 que falhou, sem duplicar', async () => {
    await cadastrarMilitar({ trigrama: 'MEN', categoria: 'graduado' });
    const a = await criarAssinante(superToken, 'MEN', { valor: 20 });
    await rodarCron('2031-03-03T03:00:00Z');
    await rodarCron('2031-03-04T03:00:00Z');
    expect(await contar("SELECT COUNT(*) as n FROM cafe_pagamentos WHERE assinante_id = ? AND referencia = '2031-03'", a.id)).toBe(1);
    await rodarCron('2031-03-06T03:00:00Z'); // dia 6: não cobra mais
    expect(await contar("SELECT COUNT(*) as n FROM cafe_pagamentos WHERE assinante_id = ?", a.id)).toBe(2); // adesão + março
    await semFalhas();
  });

  it('anual: não cobra dentro da cobertura; renova no mês seguinte ao fim (12 meses), uma vez só', async () => {
    await cadastrarMilitar({ trigrama: 'ANU', categoria: 'oficial' });
    const a = await criarAssinante(superToken, 'ANU', { plano: 'anual', valor: 240 });
    const fim = a.primeira_cobranca.periodo_fim!; // início + 11 meses
    const [ano, mes] = fim.split('-').map(Number);

    // ainda dentro da cobertura (o mês do fim): nada
    await rodarCron(`${ano}-${String(mes).padStart(2, '0')}-01T03:00:00Z`);
    expect(await contar('SELECT COUNT(*) as n FROM cafe_pagamentos WHERE assinante_id = ?', a.id)).toBe(1);

    // mês seguinte ao fim: nova anuidade de 12 meses
    const prox = somarMesesYM(fim, 1);
    const fimEsperado = somarMesesYM(prox, 11);
    await rodarCron(`${prox}-01T03:00:00Z`);
    await rodarCron(`${prox}-02T03:00:00Z`);
    const { results } = await env.DB.prepare('SELECT referencia, periodo_fim, valor FROM cafe_pagamentos WHERE assinante_id = ? AND referencia = ?').bind(a.id, prox).all();
    expect(results).toEqual([{ referencia: prox, periodo_fim: fimEsperado, valor: 240 }]);
    expect(await contar("SELECT COUNT(*) as n FROM notificacoes WHERE trigrama = 'ANU' AND titulo = 'ANUIDADE CAFÉ'")).toBe(1);
    await semFalhas();
  });

  it('assinante desativado não é cobrado', async () => {
    await cadastrarMilitar({ trigrama: 'MEN', categoria: 'graduado' });
    const a = await criarAssinante(superToken, 'MEN', { valor: 20 });
    await api(`/api/cafe/admin/assinantes/${a.id}/desativar`, { method: 'PUT', token: superToken });
    await rodarCron('2031-03-01T03:00:00Z');
    expect(await contar('SELECT COUNT(*) as n FROM cafe_pagamentos WHERE assinante_id = ?', a.id)).toBe(1);
  });

  it('fechamento mensal do RP é registrado no dia 1 quando há dívida', async () => {
    const u = await cadastrarMilitar({ trigrama: 'DEV' });
    await pedidoCantina(u.token, 'fiado');
    await rodarCron('2031-03-01T03:00:00Z');
    await semFalhas();
    const r = await env.DB.prepare("SELECT dados_depois FROM audit_log WHERE acao = 'fechamento_mensal_rp'").first<{ dados_depois: string }>();
    expect(r).not.toBeNull();
    const resumo = JSON.parse(r!.dados_depois);
    expect(resumo).toMatchObject({ total_militares: 1, mes_referencia: 2, ano_referencia: 2031 });
  });
});

describe('cron: aniversariantes', () => {
  it('parabéns sai uma vez só, mesmo rodando o cron duas vezes no dia', async () => {
    await cadastrarMilitar({ trigrama: 'NIV', data_nascimento: '1990-07-15' });
    await cadastrarMilitar({ trigrama: 'OUT', data_nascimento: '1990-07-16' });
    await rodarCron('2031-07-15T03:00:00Z');
    await rodarCron('2031-07-15T15:00:00Z');
    await semFalhas();
    expect(await contar("SELECT COUNT(*) as n FROM notificacoes WHERE trigrama = 'NIV' AND titulo = 'FELIZ ANIVERSÁRIO!'")).toBe(1);
    expect(await contar("SELECT COUNT(*) as n FROM notificacoes WHERE trigrama = 'OUT' AND titulo = 'FELIZ ANIVERSÁRIO!'")).toBe(0);
  });

  it('data no formato DD/MM/AAAA também é reconhecida', async () => {
    await cadastrarMilitar({ trigrama: 'NIV', data_nascimento: '15/07/1990' });
    await rodarCron('2031-07-15T03:00:00Z');
    expect(await contar("SELECT COUNT(*) as n FROM notificacoes WHERE trigrama = 'NIV' AND titulo = 'FELIZ ANIVERSÁRIO!'")).toBe(1);
  });

  it('usa o dia de Brasília: 02:00 UTC do dia 16 ainda é dia 15', async () => {
    await cadastrarMilitar({ trigrama: 'NIV', data_nascimento: '1990-07-15' });
    await rodarCron('2031-07-16T02:00:00Z');
    expect(await contar("SELECT COUNT(*) as n FROM notificacoes WHERE trigrama = 'NIV' AND titulo = 'FELIZ ANIVERSÁRIO!'")).toBe(1);
  });
});

describe('cron: lembrete do dia 10', () => {
  it('avisa quem tem café pendente, uma vez por dia', async () => {
    await cadastrarMilitar({ trigrama: 'PEN', categoria: 'graduado' });
    await cadastrarMilitar({ trigrama: 'PAG', categoria: 'graduado' });
    await criarAssinante(superToken, 'PEN', { valor: 20 });
    const pag = await criarAssinante(superToken, 'PAG', { valor: 20 });
    await api(`/api/cafe/admin/mensalidades/${pag.primeira_cobranca.id}/pagar`, { method: 'PUT', token: superToken });

    await rodarCron('2031-03-10T03:00:00Z');
    await rodarCron('2031-03-10T04:00:00Z');
    await semFalhas();
    expect(await contar("SELECT COUNT(*) as n FROM notificacoes WHERE trigrama = 'PEN' AND titulo = 'CAFÉ EM ABERTO'")).toBe(1);
    expect(await contar("SELECT COUNT(*) as n FROM notificacoes WHERE trigrama = 'PAG' AND titulo = 'CAFÉ EM ABERTO'")).toBe(0);
  });
});

describe('cron: dia comum', () => {
  it('dia 15: não gera cobrança nem lembrete e limpa tentativas de login antigas', async () => {
    await cadastrarMilitar({ trigrama: 'MEN', categoria: 'graduado' });
    const a = await criarAssinante(superToken, 'MEN', { valor: 20 });
    await env.DB.prepare("INSERT INTO rate_limit_attempts (key, acao, created_at) VALUES ('ip:x', 'admin_login', datetime('now', '-2 days'))").run();
    await env.DB.prepare("INSERT INTO rate_limit_attempts (key, acao) VALUES ('ip:y', 'admin_login')").run();

    await rodarCron('2031-03-15T03:00:00Z');
    await semFalhas();
    expect(await contar('SELECT COUNT(*) as n FROM cafe_pagamentos WHERE assinante_id = ?', a.id)).toBe(1);
    expect(await contar("SELECT COUNT(*) as n FROM notificacoes WHERE titulo IN ('CAFÉ EM ABERTO', 'MENSALIDADE CAFÉ')")).toBe(0);
    // só as de admin_login (cadastro também grava tentativas para o rate limit)
    expect(await contar("SELECT COUNT(*) as n FROM rate_limit_attempts WHERE acao = 'admin_login'")).toBe(1);
  });
});
