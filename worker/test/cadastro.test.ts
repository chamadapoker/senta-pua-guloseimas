// Caso 5 — cadastro: não permite assumir um militar (cliente) que já pertence a outra conta.
import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import { api, loginSuper, cadastrarMilitar, criarProdutoLoja } from './helpers/fixtures';

function corpo(over: Record<string, unknown> = {}) {
  return {
    email: 'novo@teste.local', senha: 'senha123', trigrama: 'NEW', saram: '5550001',
    whatsapp: '61999990000', categoria: 'graduado', aceite_lgpd: true, ...over,
  };
}

describe('POST /api/usuarios/cadastro', () => {
  it('cadastro válido => 201, cria usuário + cliente e o token funciona', async () => {
    const r = await api('/api/usuarios/cadastro', { body: corpo() });
    expect(r.status).toBe(201);
    expect(r.body.user).toMatchObject({ trigrama: 'NEW', categoria: 'graduado', sala_cafe: 'graduados', is_visitante: 0 });
    expect(r.body.user.senha_hash).toBeUndefined();
    const cli = await env.DB.prepare("SELECT saram FROM clientes WHERE nome_guerra = 'NEW'").first<{ saram: string }>();
    expect(cli!.saram).toBe('5550001');
    expect((await api('/api/usuarios/me', { token: r.body.token })).status).toBe(200);
    // senha guardada com hash (PBKDF2 salt:hash), nunca em texto
    const u = await env.DB.prepare("SELECT senha_hash FROM usuarios WHERE trigrama = 'NEW'").first<{ senha_hash: string }>();
    expect(u!.senha_hash).not.toContain('senha123');
    expect(u!.senha_hash).toMatch(/^[0-9a-f]{32}:[0-9a-f]{64}$/);
  });

  it('validações => 400 (sem LGPD, senha curta, trigrama/saram/categoria inválidos, campo faltando)', async () => {
    const casos = [
      corpo({ aceite_lgpd: false }),
      corpo({ senha: '123' }),
      corpo({ trigrama: 'AB' }),
      corpo({ trigrama: 'AB1' }),
      corpo({ saram: '12a' }),
      corpo({ categoria: 'general' }),
      corpo({ email: '' }),
    ];
    for (const b of casos) {
      const r = await api('/api/usuarios/cadastro', { body: b });
      expect(r.status, JSON.stringify(b)).toBe(400);
    }
    expect((await env.DB.prepare('SELECT COUNT(*) as n FROM usuarios').first<{ n: number }>())!.n).toBe(0);
  });

  it('email, trigrama ou SARAM já usados por outra conta => 409', async () => {
    await cadastrarMilitar({ trigrama: 'ABC', saram: '1110001', email: 'abc@teste.local' });
    expect((await api('/api/usuarios/cadastro', { body: corpo({ email: 'ABC@teste.local' }) })).status).toBe(409);
    expect((await api('/api/usuarios/cadastro', { body: corpo({ trigrama: 'abc' }) })).status).toBe(409);
    expect((await api('/api/usuarios/cadastro', { body: corpo({ saram: '1110001' }) })).status).toBe(409);
  });

  it('cliente já vinculado a outra conta (achado pelo SARAM) => 409 e nada é criado', async () => {
    // Conta "OLD" existente; o cliente dela ficou com o SARAM 2220002 (ex.: corrigido pelo admin)
    await cadastrarMilitar({ trigrama: 'OLD', saram: '9990009' });
    await env.DB.prepare("UPDATE clientes SET saram = '2220002' WHERE nome_guerra = 'OLD'").run();

    const r = await api('/api/usuarios/cadastro', { body: corpo({ trigrama: 'NEW', saram: '2220002' }) });
    expect(r.status).toBe(409);
    expect(r.body.error).toMatch(/vinculado a outra conta/);
    expect((await env.DB.prepare("SELECT COUNT(*) as n FROM usuarios WHERE email = 'novo@teste.local'").first<{ n: number }>())!.n).toBe(0);
    // o cliente da outra conta continua intacto
    const cli = await env.DB.prepare("SELECT nome_guerra, saram FROM clientes WHERE saram = '2220002'").first();
    expect(cli).toEqual({ nome_guerra: 'OLD', saram: '2220002' });
  });

  it('cadastro de visitante também não assume cliente de outra conta => 409', async () => {
    await cadastrarMilitar({ trigrama: 'OLD', saram: '9990009' });
    await env.DB.prepare("UPDATE clientes SET saram = '2220002' WHERE nome_guerra = 'OLD'").run();
    const r = await api('/api/usuarios/cadastro/visitante', { body: corpo({ trigrama: 'NEW', saram: '2220002', esquadrao_origem: '1/1 GAV' }) });
    expect(r.status).toBe(409);
  });

  it('trigrama de cliente registrado com outro SARAM => 409', async () => {
    await env.DB.prepare("INSERT INTO clientes (nome_guerra, saram) VALUES ('XYZ', '3330003')").run();
    const r = await api('/api/usuarios/cadastro', { body: corpo({ trigrama: 'XYZ', saram: '4440004' }) });
    expect(r.status).toBe(409);
    expect(r.body.error).toMatch(/outro SARAM/);
  });

  it('cliente sem conta (só histórico anônimo) é vinculado ao novo cadastro, sem duplicar', async () => {
    const sup = await loginSuper();
    const prod = await criarProdutoLoja(sup.token);
    const anon = await api('/api/loja/pedidos', { body: { nome_guerra: 'HIS', whatsapp: '6100', itens: [{ produto_id: prod.id, quantidade: 1 }], metodo: 'pix' } });
    expect(anon.status).toBe(201);

    const r = await api('/api/usuarios/cadastro', { body: corpo({ trigrama: 'HIS', saram: '6660006' }) });
    expect(r.status).toBe(201);
    const clis = await env.DB.prepare("SELECT id, saram, whatsapp FROM clientes WHERE nome_guerra = 'HIS'").all<{ id: string; saram: string; whatsapp: string }>();
    expect(clis.results.length).toBe(1);
    expect(clis.results[0]).toMatchObject({ saram: '6660006', whatsapp: '6100' }); // whatsapp existente é mantido
    const audit = await env.DB.prepare("SELECT COUNT(*) as n FROM audit_log WHERE acao = 'cadastro_vincula_cliente'").first<{ n: number }>();
    expect(audit!.n).toBe(1);
    // e o histórico aparece no extrato do novo usuário
    const ext = await api('/api/usuarios/me/extrato', { token: r.body.token });
    expect(ext.body.loja.length).toBe(1);
  });
});

describe('POST /api/usuarios/login', () => {
  it('login certo => 200; senha errada/email inexistente => 401 com a mesma mensagem', async () => {
    const u = await cadastrarMilitar({ trigrama: 'LOG' });
    const ok = await api('/api/usuarios/login', { body: { email: u.email, senha: u.senha } });
    expect(ok.status).toBe(200);
    expect(ok.body.user.senha_hash).toBeUndefined();
    const errada = await api('/api/usuarios/login', { body: { email: u.email, senha: 'xxxxxx' } });
    const inexistente = await api('/api/usuarios/login', { body: { email: 'nao@existe.local', senha: 'xxxxxx' } });
    expect(errada.status).toBe(401);
    expect(inexistente.status).toBe(401);
    expect(errada.body.error).toBe(inexistente.body.error);
  });

  it('conta desativada => 403', async () => {
    const sup = await loginSuper();
    const u = await cadastrarMilitar({ trigrama: 'LOG' });
    await api(`/api/usuarios/admin/${u.id}/desativar`, { method: 'PUT', token: sup.token });
    expect((await api('/api/usuarios/login', { body: { email: u.email, senha: u.senha } })).status).toBe(403);
  });
});
