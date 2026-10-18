// ACHADOS — comportamentos inseguros encontrados ao escrever a suíte (fase de segurança, parte 1).
// Corrigidos na parte 2: os testes, antes marcados com it.fails, agora são `it` normais e protegem
// contra regressão. Cada teste descreve o comportamento CORRETO.
import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import { api, loginSuper, cadastrarMilitar, pedidoCantina } from './helpers/fixtures';

describe('ACHADO 1 — token de usuário desativado continua valendo (até 30 dias)', () => {
  // userAuthMiddleware só valida a assinatura do JWT; não confere usuarios.ativo no banco
  // (o authMiddleware de admin confere). Login é recusado, mas o token antigo segue lendo extrato,
  // notificações e enviando comprovantes.
  it('usuário desativado pelo admin deveria perder o acesso na hora (401/403)', async () => {
    const sup = await loginSuper();
    const u = await cadastrarMilitar({ trigrama: 'DES' });
    await api(`/api/usuarios/admin/${u.id}/desativar`, { method: 'PUT', token: sup.token });
    const r = await api('/api/usuarios/me/extrato', { token: u.token });
    expect([401, 403]).toContain(r.status);
  });
});

describe('ACHADO 2 — trigrama do token desatualizado após o admin renomear o militar', () => {
  // /me/extrato, /me/cafe, /me/dashboard, comprovantes e notificações usam o trigrama gravado no JWT
  // (válido por 720h). Se o admin renomeia AAA -> ABC e depois outra pessoa se cadastra como AAA,
  // o token antigo do primeiro militar passa a ler os dados do NOVO AAA.
  it('token antigo não deveria enxergar dados de outra pessoa que assumiu o trigrama', async () => {
    const sup = await loginSuper();
    const antigo = await cadastrarMilitar({ trigrama: 'AAA' });
    const ren = await api(`/api/usuarios/admin/${antigo.id}`, { method: 'PUT', token: sup.token, body: { trigrama: 'ABC' } });
    expect(ren.status).toBe(200);

    const novo = await cadastrarMilitar({ trigrama: 'AAA' });
    const ped = await pedidoCantina(novo.token, 'fiado');
    expect(ped.status).toBe(201);

    const r = await api('/api/usuarios/me/extrato', { token: antigo.token });
    // correto: ou o token antigo é recusado, ou mostra só os dados do próprio (ABC)
    if (r.status === 200) expect(r.body.guloseimas.map((p: any) => p.id)).not.toContain(ped.body.pedido_id);
    else expect([401, 403]).toContain(r.status);
  });
});

describe('ACHADO 3 — rotas públicas de pedido devolvem a linha inteira', () => {
  // GET /api/pedidos/:id e GET /api/loja/pedidos/:id são públicas (polling do PIX) e fazem SELECT *:
  // expõem cliente_id e, na loja, o endereço de entrega. O id é aleatório (128 bits), então o risco é
  // baixo, mas quem tiver o link vê dados pessoais sem login.
  it('pedido da loja com envio não deveria expor o endereço sem login', async () => {
    const sup = await loginSuper();
    await api('/api/config', { method: 'PUT', token: sup.token, body: { loja_frete: '10' } });
    const prod = await api('/api/loja/admin/produtos', { token: sup.token, body: { nome: 'Caneca', preco: 30 } });
    const u = await cadastrarMilitar({ trigrama: 'END' });
    const ped = await api('/api/loja/pedidos', {
      token: u.token,
      body: { itens: [{ produto_id: prod.body.id, quantidade: 1 }], metodo: 'pix', entrega_tipo: 'envio', endereco: 'Rua Secreta, 123' },
    });
    expect(ped.status).toBe(201);
    const pub = await api(`/api/loja/pedidos/${ped.body.pedido_id}`);
    expect(JSON.stringify(pub.body)).not.toContain('Rua Secreta');
  });
});

describe('ACHADO 4 — imagens de comprovante são públicas', () => {
  // GET /api/images/:prefix/:rest serve qualquer chave do R2 sem login, inclusive comprovantes/<uuid>.<ext>
  // (comprovante de pagamento = dado pessoal/financeiro), com Cache-Control público de 1 ano.
  it('imagem de comprovante não deveria ser servida sem login', async () => {
    const u = await cadastrarMilitar({ trigrama: 'CMP' });
    const ped = await pedidoCantina(u.token, 'pix');
    const form = new FormData();
    form.append('origem', 'cantina');
    form.append('referencia_id', ped.body.pedido_id);
    form.append('file', new File([new Uint8Array([0xff, 0xd8, 0xff])], 'c.jpg', { type: 'image/jpeg' }));
    const c = await api('/api/comprovantes', { method: 'POST', token: u.token, form });
    expect(c.status).toBe(201);
    const img = await api(c.body.imagem_url);
    expect([401, 403, 404]).toContain(img.status);
  });
});

describe('ACHADO 5 — login de usuário revela conta desativada sem a senha', () => {
  // POST /api/usuarios/login responde 403 "Conta desativada" ANTES de conferir a senha
  // (e sem registrar tentativa no rate limit): dá para descobrir que o email existe e está desativado.
  it('senha errada em conta desativada deveria dar o mesmo 401 genérico', async () => {
    const sup = await loginSuper();
    const u = await cadastrarMilitar({ trigrama: 'ENU' });
    await api(`/api/usuarios/admin/${u.id}/desativar`, { method: 'PUT', token: sup.token });
    const r = await api('/api/usuarios/login', { body: { email: u.email, senha: 'senha-qualquer-errada' } });
    expect(r.status).toBe(401);
  });
});

describe('ACHADO 6 — corpo JSON inválido vira 500 em vez de 400', () => {
  // Várias rotas fazem `await c.req.json()` sem try/catch; corpo vazio/inválido cai no onError (500).
  // A resposta é genérica (não vaza stack), mas 500 polui o monitoramento e mascara erro do cliente.
  it('login admin sem corpo deveria responder 400', async () => {
    const r = await api('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    expect(r.status).toBe(400);
  });
});

describe('controle: os achados acima não afetam o fluxo normal', () => {
  it('usuário ativo com trigrama estável lê o próprio extrato', async () => {
    const u = await cadastrarMilitar({ trigrama: 'OKK' });
    await pedidoCantina(u.token, 'fiado');
    const r = await api('/api/usuarios/me/extrato', { token: u.token });
    expect(r.status).toBe(200);
    expect(r.body.guloseimas.length).toBe(1);
    expect((await env.DB.prepare("SELECT ativo FROM usuarios WHERE trigrama = 'OKK'").first<{ ativo: number }>())!.ativo).toBe(1);
  });
});
