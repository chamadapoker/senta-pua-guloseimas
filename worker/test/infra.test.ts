// Sanidade do ambiente de teste: banco montado a partir do schema + migrations e Worker respondendo.
import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import { api } from './helpers/fixtures';

describe('infra de teste', () => {
  it('health responde', async () => {
    const r = await api('/api/health');
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ status: 'ok' });
  });

  it('banco tem as colunas das últimas migrations e a coluna saram de produção', async () => {
    const cols = async (t: string) =>
      (await env.DB.prepare(`PRAGMA table_info(${t})`).all<{ name: string }>()).results.map((c) => c.name);
    expect(await cols('admins')).toContain('escopo');
    expect(await cols('cafe_pagamentos')).toContain('periodo_fim');
    expect(await cols('clientes')).toEqual(expect.arrayContaining(['saram', 'visitante', 'esquadrao_origem']));
    expect(await cols('usuarios')).toEqual(expect.arrayContaining(['data_nascimento', 'permite_fiado', 'is_recepcionista']));
    const prod = await env.DB.prepare("SELECT COUNT(*) as n FROM produtos WHERE categoria = 'oficiais'").first<{ n: number }>();
    expect(prod!.n).toBe(6);
  });

  it('cada teste começa com o banco limpo (resetarBanco)', async () => {
    await env.DB.prepare("INSERT INTO configuracoes (chave, valor) VALUES ('teste_isolamento', '1')").run();
    const r = await env.DB.prepare("SELECT valor FROM configuracoes WHERE chave = 'teste_isolamento'").first();
    expect(r).not.toBeNull();
  });

  it('...e o teste anterior não deixou rastro', async () => {
    const r = await env.DB.prepare("SELECT valor FROM configuracoes WHERE chave = 'teste_isolamento'").first();
    expect(r).toBeNull();
  });
});
