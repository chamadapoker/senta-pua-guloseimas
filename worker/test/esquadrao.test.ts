// Identidade do esquadrão no servidor (src/lib/esquadrao.ts). Com o padrão (wrangler.toml:
// ESQUADRAO = "senta-pua") os textos e o CORS têm que ser EXATAMENTE os de antes da troca para
// config; com ESQUADRAO = "exemplo" (env passado direto ao handler) saem os textos do exemplo.
import { env, createExecutionContext, createScheduledController, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import worker, { type Env } from '../src/index';
import { escolherEsquadrao, esquadraoDoEnv, esquadroesDisponiveis, textoLembreteCafe, ESQUADRAO_PADRAO } from '../src/lib/esquadrao';
import { origensPermitidas } from '../src/lib/cors';
import { BASE, loginSuper, cadastrarMilitar, criarAssinante } from './helpers/fixtures';
import exemploJson from '../../app/esquadroes/exemplo.json';

// Textos exatos do Senta Pua antes da migração para app/esquadroes/senta-pua.json
const SP_MENSALIDADE = [
  'A disciplina financeira é a base da operatividade. Sua mensalidade do café foi lançada no extrato.',
  'Radar limpo e conta paga. Esse é o lema. Confira seu extrato, a mensalidade do café já está disponível.',
  'O esquadrão conta com sua pontualidade para manter o café quente. Mensalidade lançada com sucesso.',
  'Missão dada é missão cumprida. Sua mensalidade do café foi registrada. Mantenha seu radar em dia.',
];
const SP_ANUIDADE = [
  'Anuidade do café lançada no seu extrato. Disciplina o ano inteiro mantém o radar limpo!',
  'Sua contribuição anual do café foi registrada. Café quente garantido, Senta a Pua!',
  'Anuidade do café no extrato. Missão de um ano, cumprida de uma vez. Mantenha o radar em dia.',
];
const SP_ANIVERSARIO = 'O Esquadrão Senta Pua te deseja um excelente dia e um feliz aniversário! Lembre-se: o RP pode até esquecer o próprio nome, mas nunca esquece da sua dívida. Senta a Pua!';
const SP_HOMENAGEM = 'O 1/10 GpAv deseja a você muitas felicidades e sucesso!';
const loteAntigo = (qtd: number, total: number) =>
  `Você tem ${qtd} ${qtd === 1 ? 'cobrança' : 'cobranças'} do café em aberto (mensalidade/anuidade), total de R$ ${total.toFixed(2).replace('.', ',')}. Pague pelo app com PIX e envie o comprovante.`;

const ENV_EXEMPLO = (): Env => ({ ...env, ESQUADRAO: 'exemplo' });

async function rodarCron(quandoUtc: string, e: Env = env) {
  vi.setSystemTime(new Date(quandoUtc));
  const ctrl = createScheduledController({ scheduledTime: new Date(quandoUtc), cron: '0 3 * * *' });
  const ctx = createExecutionContext();
  await worker.scheduled(ctrl as unknown as ScheduledEvent, e, ctx);
  await waitOnExecutionContext(ctx);
  vi.useRealTimers();
  vi.useFakeTimers({ toFake: ['Date'] });
}

async function fetchCom(e: Env, path: string, headers: Record<string, string> = {}) {
  const ctx = createExecutionContext();
  const res = await worker.fetch(new Request(`${BASE}${path}`, { headers }), e, ctx);
  const texto = await res.text();
  await waitOnExecutionContext(ctx);
  let body: any = texto;
  try { body = JSON.parse(texto); } catch { /* texto puro */ }
  return { status: res.status, headers: res.headers, body };
}

async function mensagens(trigrama: string, titulo: string): Promise<string[]> {
  const { results } = await env.DB.prepare('SELECT mensagem FROM notificacoes WHERE trigrama = ? AND titulo = ?')
    .bind(trigrama, titulo).all<{ mensagem: string }>();
  return results.map((r) => r.mensagem);
}

function hojeBrasiliaMMDD(): string {
  const d = new Date(Date.now() - 3 * 3600 * 1000);
  return `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

describe('escolha do esquadrão (função)', () => {
  it('padrão do wrangler.toml é senta-pua', () => {
    expect(env.ESQUADRAO).toBe('senta-pua');
    expect(esquadraoDoEnv(env).id).toBe('senta-pua');
    expect(ESQUADRAO_PADRAO.id).toBe('senta-pua');
  });

  it('ausente/vazio => senta-pua; "exemplo" => exemplo', () => {
    for (const v of [undefined, null, '', '  ']) expect(escolherEsquadrao(v).id).toBe('senta-pua');
    expect(escolherEsquadrao('exemplo').id).toBe('exemplo');
    expect(escolherEsquadrao(' exemplo ').id).toBe('exemplo');
    expect(esquadroesDisponiveis()).toEqual(expect.arrayContaining(['senta-pua', 'exemplo']));
  });

  it('id desconhecido => senta-pua com aviso no console (uma vez)', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      expect(escolherEsquadrao('nao-existe').id).toBe('senta-pua');
      expect(escolherEsquadrao('nao-existe').id).toBe('senta-pua');
      expect(escolherEsquadrao('__proto__').id).toBe('senta-pua');
      expect(spy).toHaveBeenCalledTimes(2);
      expect(String(spy.mock.calls[0][0])).toContain('nao-existe');
    } finally {
      spy.mockRestore();
    }
  });

  it('senta-pua: textos do servidor idênticos aos de antes', () => {
    const s = ESQUADRAO_PADRAO.servidor;
    expect(s.mensalidade_cafe).toEqual(SP_MENSALIDADE);
    expect(s.anuidade_cafe).toEqual(SP_ANUIDADE);
    expect(s.aniversario_notificacao).toBe(SP_ANIVERSARIO);
    expect(s.aniversario_homenagem).toBe(SP_HOMENAGEM);
    for (const [q, t] of [[1, 20], [2, 45.5], [3, 1234.567]] as const) {
      expect(textoLembreteCafe(ESQUADRAO_PADRAO, q, t)).toBe(loteAntigo(q, t));
    }
  });
});

describe('CORS por esquadrão', () => {
  it('senta-pua: mesma lista de antes', () => {
    expect(origensPermitidas(undefined)).toEqual(['https://app-senta-pua.pages.dev', 'http://localhost:5173']);
    expect(origensPermitidas(undefined, ESQUADRAO_PADRAO.url_app)).toEqual(['https://app-senta-pua.pages.dev', 'http://localhost:5173']);
    expect(origensPermitidas('https://app.exemplo.com/')).toEqual(['https://app.exemplo.com', 'https://app-senta-pua.pages.dev', 'http://localhost:5173']);
    expect(origensPermitidas('https://app-senta-pua.pages.dev/')).toEqual(['https://app-senta-pua.pages.dev', 'http://localhost:5173']);
  });

  it('exemplo: url_app do exemplo no lugar do senta-pua', () => {
    expect(origensPermitidas(undefined, exemploJson.url_app)).toEqual(['https://app-exemplo.pages.dev', 'http://localhost:5173']);
  });

  it('requisição real: senta-pua aceita a origem do Pages; exemplo não (e vice-versa)', async () => {
    const sp = await fetchCom(env, '/api/health', { Origin: 'https://app-senta-pua.pages.dev' });
    expect(sp.headers.get('Access-Control-Allow-Origin')).toBe('https://app-senta-pua.pages.dev');
    const spEx = await fetchCom(env, '/api/health', { Origin: 'https://app-exemplo.pages.dev' });
    expect(spEx.headers.get('Access-Control-Allow-Origin')).toBeNull();

    const ex = await fetchCom(ENV_EXEMPLO(), '/api/health', { Origin: 'https://app-exemplo.pages.dev' });
    expect(ex.headers.get('Access-Control-Allow-Origin')).toBe('https://app-exemplo.pages.dev');
    const exSp = await fetchCom(ENV_EXEMPLO(), '/api/health', { Origin: 'https://app-senta-pua.pages.dev' });
    expect(exSp.headers.get('Access-Control-Allow-Origin')).toBeNull();
    // localhost e FRONTEND_URL continuam valendo nos dois
    const loc = await fetchCom(ENV_EXEMPLO(), '/api/health', { Origin: 'http://localhost:5173' });
    expect(loc.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
  });
});

describe('cron e homenagem por esquadrão', () => {
  let superToken: string;
  beforeEach(async () => {
    superToken = (await loginSuper()).token;
    vi.useFakeTimers({ toFake: ['Date'] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('senta-pua: mensalidade, anuidade, aniversário e lembrete com os textos de hoje', async () => {
    await cadastrarMilitar({ trigrama: 'MEN', categoria: 'graduado', data_nascimento: '1990-03-01' });
    await cadastrarMilitar({ trigrama: 'ANU', categoria: 'oficial' });
    await criarAssinante(superToken, 'MEN', { valor: 20 });
    const anu = await criarAssinante(superToken, 'ANU', { plano: 'anual', valor: 240 });
    // força a renovação da anuidade em 2031-03 (fim da cobertura no passado)
    await env.DB.prepare("UPDATE cafe_pagamentos SET referencia = '2029-01', periodo_fim = '2029-12' WHERE assinante_id = ?").bind(anu.id).run();

    await rodarCron('2031-03-01T03:00:00Z');
    const men = await mensagens('MEN', 'MENSALIDADE CAFÉ');
    expect(men).toHaveLength(1);
    expect(SP_MENSALIDADE).toContain(men[0]);
    const an = await mensagens('ANU', 'ANUIDADE CAFÉ');
    expect(an).toHaveLength(1);
    expect(SP_ANUIDADE.map((f) => `${f} (`).some((p) => an[0].startsWith(p))).toBe(true);
    expect(await mensagens('MEN', 'FELIZ ANIVERSÁRIO!')).toEqual([SP_ANIVERSARIO]);

    await rodarCron('2031-03-10T03:00:00Z');
    const pend = await mensagens('MEN', 'CAFÉ EM ABERTO');
    // adesão + março, ambas pendentes, 20 cada
    expect(pend).toEqual([loteAntigo(2, 40)]);
  });

  it('exemplo: o cron usa os textos do exemplo.json', async () => {
    await cadastrarMilitar({ trigrama: 'MEN', categoria: 'graduado', data_nascimento: '1990-03-01' });
    await criarAssinante(superToken, 'MEN', { valor: 20 });

    await rodarCron('2031-03-01T03:00:00Z', ENV_EXEMPLO());
    const men = await mensagens('MEN', 'MENSALIDADE CAFÉ');
    expect(men).toHaveLength(1);
    expect(exemploJson.servidor.mensalidade_cafe).toContain(men[0]);
    expect(await mensagens('MEN', 'FELIZ ANIVERSÁRIO!')).toEqual([exemploJson.servidor.aniversario_notificacao]);
    expect(exemploJson.servidor.aniversario_notificacao).not.toContain('Senta');

    await rodarCron('2031-03-10T03:00:00Z', ENV_EXEMPLO());
    expect(await mensagens('MEN', 'CAFÉ EM ABERTO')).toEqual([
      textoLembreteCafe(escolherEsquadrao('exemplo'), 2, 40),
    ]);
  });

  it('homenagem padrão do aniversário no /me/dashboard: senta-pua e exemplo', async () => {
    vi.useRealTimers();
    const u = await cadastrarMilitar({ trigrama: 'NIV', data_nascimento: `1990-${hojeBrasiliaMMDD()}` });
    const auth = { Authorization: `Bearer ${u.token}` };

    const sp = await fetchCom(env, '/api/usuarios/me/dashboard', auth);
    expect(sp.status).toBe(200);
    expect(sp.body.aniversario).toEqual({ titulo: 'Feliz Aniversário!', texto: SP_HOMENAGEM, imagem_url: null });

    const ex = await fetchCom(ENV_EXEMPLO(), '/api/usuarios/me/dashboard', auth);
    expect(ex.status).toBe(200);
    expect(ex.body.aniversario.texto).toBe(exemploJson.servidor.aniversario_homenagem);
  });
});
