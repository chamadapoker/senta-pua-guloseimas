// Caso 8 — rotas públicas não expõem dados internos (OWASP A01/A02 — exposição de dados).
import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import { api, loginSuper, cadastrarMilitar, criarProdutoLoja, criarAssinante } from './helpers/fixtures';

describe('preco_custo não sai em rota pública', () => {
  it('cantina: /api/produtos sem preco_custo; /api/produtos/todos (admin) com', async () => {
    const { token } = await loginSuper();
    const criado = await api('/api/produtos', { token, body: { nome: 'Barra', preco: 5, preco_custo: 2.5, categoria: 'graduados' } });
    expect(criado.status).toBe(201);

    for (const q of ['', '?categoria=graduados']) {
      const pub = await api(`/api/produtos${q}`);
      expect(pub.status).toBe(200);
      expect(pub.body.length).toBeGreaterThan(0);
      for (const p of pub.body) expect(p, JSON.stringify(p)).not.toHaveProperty('preco_custo');
      expect(JSON.stringify(pub.body)).not.toContain('2.5');
    }

    const adm = await api('/api/produtos/todos', { token });
    expect(adm.body.find((p: any) => p.id === criado.body.id).preco_custo).toBe(2.5);
    expect((await api('/api/produtos/todos')).status).toBe(401);
  });

  it('loja: /api/loja/produtos sem preco_custo; /api/loja/admin/produtos (admin) com', async () => {
    const { token } = await loginSuper();
    const prod = await criarProdutoLoja(token, { preco: 90, preco_custo: 37.77 });
    const pub = await api('/api/loja/produtos');
    expect(pub.status).toBe(200);
    expect(pub.body.length).toBe(1);
    expect(pub.body[0]).not.toHaveProperty('preco_custo');
    expect(JSON.stringify(pub.body)).not.toContain('37.77');

    const adm = await api('/api/loja/admin/produtos', { token });
    expect(adm.body.find((p: any) => p.id === prod.id).preco_custo).toBe(37.77);
    expect((await api('/api/loja/admin/produtos')).status).toBe(401);
  });
});

describe('/api/cafe/devedores exige admin', () => {
  it('sem token => 401; token de usuário => 401; admin => 200 com os dados', async () => {
    const { token } = await loginSuper();
    const u = await cadastrarMilitar({ trigrama: 'DEV', categoria: 'graduado' });
    await criarAssinante(token, 'DEV', { valor: 20 });

    const anon = await api('/api/cafe/devedores');
    expect(anon.status).toBe(401);
    expect(JSON.stringify(anon.body)).not.toContain('DEV');
    expect((await api('/api/cafe/devedores', { token: u.token })).status).toBe(401);

    const adm = await api('/api/cafe/devedores', { token });
    expect(adm.status).toBe(200);
    expect(adm.body[0]).toMatchObject({ nome_guerra: 'DEV', total_devido: 20 });
    expect(adm.body[0].pagamento_ids.length).toBe(1);
  });
});

describe('outras rotas públicas', () => {
  it('busca de clientes (autocomplete) não expõe saram/whatsapp', async () => {
    await cadastrarMilitar({ trigrama: 'BUS' });
    const r = await api('/api/clientes/buscar?q=BU');
    expect(r.status).toBe(200);
    expect(r.body.length).toBe(1);
    expect(Object.keys(r.body[0]).sort()).toEqual(['esquadrao_origem', 'id', 'nome_guerra', 'visitante']);
  });

  it('webhook PIX (não implementado) responde 501 e não altera pedidos', async () => {
    const r = await api('/api/pix/webhook', { body: { pedido_id: 'x', status: 'pago' } });
    expect(r.status).toBe(501);
    expect(r.body).toEqual({ error: 'Integração PIX automática não configurada' });
    const pagos = await env.DB.prepare("SELECT COUNT(*) as n FROM pedidos WHERE status = 'pago'").first<{ n: number }>();
    expect(pagos!.n).toBe(0);
  });

  it('upload/remoção de imagem exigem admin', async () => {
    const form = new FormData();
    form.append('file', new File([new Uint8Array([1, 2, 3])], 'x.png', { type: 'image/png' }));
    expect((await api('/api/images/upload', { method: 'POST', form })).status).toBe(401);
    expect((await api('/api/images/produtos/x.png', { method: 'DELETE' })).status).toBe(401);
  });

  it('erro não tratado não vaza stack (JSON genérico)', async () => {
    // JSON inválido no login quebra o c.req.json() e cai no onError global
    const res = await api('/api/auth/login', { method: 'POST', body: undefined, headers: { 'Content-Type': 'application/json' } });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Requisição inválida' });
    expect(JSON.stringify(res.body)).not.toMatch(/at .*\.ts|stack/i);
  });
});
