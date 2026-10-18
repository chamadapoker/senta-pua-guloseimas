// Caso 6 — loja: pagar parcela/pedido mantém pedido e parcelas coerentes (integridade, OWASP A04/A08).
import { env } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import { api, loginSuper, cadastrarMilitar, criarProdutoLoja, enviarComprovante, type Usuario } from './helpers/fixtures';

let superToken: string;
let user: Usuario;
let produtoId: string;

// Pedido PIX de R$ 100 (produto criado no beforeEach) em N parcelas
async function novoPedido(parcelas: number): Promise<{ pedidoId: string; parcelas: { id: string; numero: number; valor: number; status: string }[] }> {
  const r = await api('/api/loja/pedidos', { token: user.token, body: { itens: [{ produto_id: produtoId, quantidade: 1 }], metodo: 'pix', parcelas } });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  const p = await api(`/api/loja/admin/pedidos/${r.body.pedido_id}/parcelas`, { token: superToken });
  return { pedidoId: r.body.pedido_id, parcelas: p.body };
}

async function estado(pedidoId: string) {
  const ped = await env.DB.prepare('SELECT status, paid_at, total, parcelas FROM loja_pedidos WHERE id = ?').bind(pedidoId).first<{ status: string; paid_at: string | null; total: number; parcelas: number }>();
  const { results } = await env.DB.prepare('SELECT numero, status, valor FROM loja_parcelas WHERE pedido_id = ? ORDER BY numero').bind(pedidoId).all<{ numero: number; status: string; valor: number }>();
  return { ped: ped!, parcelas: results };
}

beforeEach(async () => {
  superToken = (await loginSuper()).token;
  await api('/api/config', { method: 'PUT', token: superToken, body: { loja_max_parcelas: '3' } });
  produtoId = (await criarProdutoLoja(superToken, { preco: 100 })).id;
  user = await cadastrarMilitar({ trigrama: 'LOJ' });
});

describe('parcelamento', () => {
  it('3 parcelas somam o total (a última absorve o arredondamento)', async () => {
    const { pedidoId, parcelas } = await novoPedido(3);
    expect(parcelas.map((p) => p.valor)).toEqual([33.33, 33.33, 33.34]);
    const e = await estado(pedidoId);
    expect(e.ped).toMatchObject({ total: 100, parcelas: 3, status: 'pendente' });
  });

  it('pedir mais parcelas que o máximo configurado é limitado ao máximo', async () => {
    const { parcelas } = await novoPedido(12);
    expect(parcelas.length).toBe(3);
  });
});

describe('pagar parcela', () => {
  it('pagar parcelas uma a uma: pedido só fica pago na última', async () => {
    const { pedidoId, parcelas } = await novoPedido(3);

    expect((await api(`/api/loja/admin/parcelas/${parcelas[0].id}/pagar`, { method: 'PUT', token: superToken })).status).toBe(200);
    let e = await estado(pedidoId);
    expect(e.ped.status).toBe('pendente');
    expect(e.ped.paid_at).toBeNull();
    expect(e.parcelas.map((p) => p.status)).toEqual(['pago', 'pendente', 'pendente']);

    await api(`/api/loja/admin/parcelas/${parcelas[2].id}/pagar`, { method: 'PUT', token: superToken });
    e = await estado(pedidoId);
    expect(e.ped.status).toBe('pendente');

    await api(`/api/loja/admin/parcelas/${parcelas[1].id}/pagar`, { method: 'PUT', token: superToken });
    e = await estado(pedidoId);
    expect(e.ped.status).toBe('pago');
    expect(e.ped.paid_at).not.toBeNull();
    expect(e.parcelas.every((p) => p.status === 'pago')).toBe(true);
  });

  it('pagar parcela já paga => 404 (não duplica)', async () => {
    const { parcelas } = await novoPedido(2);
    expect((await api(`/api/loja/admin/parcelas/${parcelas[0].id}/pagar`, { method: 'PUT', token: superToken })).status).toBe(200);
    expect((await api(`/api/loja/admin/parcelas/${parcelas[0].id}/pagar`, { method: 'PUT', token: superToken })).status).toBe(404);
  });

  it('parcela inexistente => 404', async () => {
    expect((await api('/api/loja/admin/parcelas/nao-existe/pagar', { method: 'PUT', token: superToken })).status).toBe(404);
  });

  it('parcela única: pagar a parcela quita o pedido', async () => {
    const { pedidoId, parcelas } = await novoPedido(1);
    await api(`/api/loja/admin/parcelas/${parcelas[0].id}/pagar`, { method: 'PUT', token: superToken });
    expect((await estado(pedidoId)).ped.status).toBe('pago');
  });
});

describe('pagar pedido inteiro', () => {
  it('quita todas as parcelas pendentes (inclusive com uma já paga)', async () => {
    const { pedidoId, parcelas } = await novoPedido(3);
    await api(`/api/loja/admin/parcelas/${parcelas[0].id}/pagar`, { method: 'PUT', token: superToken });
    const r = await api(`/api/loja/admin/pedidos/${pedidoId}/pagar`, { method: 'PUT', token: superToken });
    expect(r.status).toBe(200);
    const e = await estado(pedidoId);
    expect(e.ped.status).toBe('pago');
    expect(e.parcelas.every((p) => p.status === 'pago')).toBe(true);
    const audit = await env.DB.prepare("SELECT dados_depois FROM audit_log WHERE acao = 'pagar_pedido_loja'").first<{ dados_depois: string }>();
    expect(JSON.parse(audit!.dados_depois).parcelas_quitadas).toBe(2);
  });

  it('pedido já pago => 404', async () => {
    const { pedidoId } = await novoPedido(2);
    expect((await api(`/api/loja/admin/pedidos/${pedidoId}/pagar`, { method: 'PUT', token: superToken })).status).toBe(200);
    expect((await api(`/api/loja/admin/pedidos/${pedidoId}/pagar`, { method: 'PUT', token: superToken })).status).toBe(404);
  });

  it('excluir pedido remove itens e parcelas (sem órfãs)', async () => {
    const { pedidoId } = await novoPedido(3);
    expect((await api(`/api/loja/admin/pedidos/${pedidoId}`, { method: 'DELETE', token: superToken })).status).toBe(200);
    const orf = await env.DB.prepare('SELECT (SELECT COUNT(*) FROM loja_parcelas WHERE pedido_id = ?) + (SELECT COUNT(*) FROM loja_itens_pedido WHERE pedido_id = ?) as n').bind(pedidoId, pedidoId).first<{ n: number }>();
    expect(orf!.n).toBe(0);
  });
});

describe('via comprovante', () => {
  it('aprovar comprovante da última parcela quita o pedido; do pedido inteiro quita as parcelas', async () => {
    const a = await novoPedido(2);
    const c1 = await enviarComprovante(user.token, 'loja_parcela', a.parcelas[0].id);
    const c2 = await enviarComprovante(user.token, 'loja_parcela', a.parcelas[1].id);
    await api(`/api/comprovantes/${c1.body.id}/aprovar`, { method: 'PUT', token: superToken });
    expect((await estado(a.pedidoId)).ped.status).toBe('pendente');
    await api(`/api/comprovantes/${c2.body.id}/aprovar`, { method: 'PUT', token: superToken });
    expect((await estado(a.pedidoId)).ped.status).toBe('pago');

    const b = await novoPedido(3);
    const cb = await enviarComprovante(user.token, 'loja', b.pedidoId);
    expect(cb.status).toBe(201);
    await api(`/api/comprovantes/${cb.body.id}/aprovar`, { method: 'PUT', token: superToken });
    const e = await estado(b.pedidoId);
    expect(e.ped.status).toBe('pago');
    expect(e.parcelas.every((p) => p.status === 'pago')).toBe(true);
  });

  it('comprovante duplicado aguardando => 409; de parcela de outro usuário => 403', async () => {
    const a = await novoPedido(2);
    expect((await enviarComprovante(user.token, 'loja_parcela', a.parcelas[0].id)).status).toBe(201);
    expect((await enviarComprovante(user.token, 'loja_parcela', a.parcelas[0].id)).status).toBe(409);
    const outro = await cadastrarMilitar({ trigrama: 'OUT' });
    expect((await enviarComprovante(outro.token, 'loja_parcela', a.parcelas[1].id)).status).toBe(403);
  });

  it('aprovar o mesmo comprovante duas vezes => 400 na segunda', async () => {
    const a = await novoPedido(1);
    const c = await enviarComprovante(user.token, 'loja', a.pedidoId);
    expect((await api(`/api/comprovantes/${c.body.id}/aprovar`, { method: 'PUT', token: superToken })).status).toBe(200);
    expect((await api(`/api/comprovantes/${c.body.id}/aprovar`, { method: 'PUT', token: superToken })).status).toBe(400);
  });
});

describe('autorização das rotas de pagamento da loja', () => {
  it('usuário ou sem token não marcam como pago (401)', async () => {
    const { pedidoId, parcelas } = await novoPedido(2);
    for (const token of [null, user.token]) {
      expect((await api(`/api/loja/admin/pedidos/${pedidoId}/pagar`, { method: 'PUT', token })).status).toBe(401);
      expect((await api(`/api/loja/admin/parcelas/${parcelas[0].id}/pagar`, { method: 'PUT', token })).status).toBe(401);
    }
    const e = await estado(pedidoId);
    expect(e.ped.status).toBe('pendente');
    expect(e.parcelas.every((p) => p.status === 'pendente')).toBe(true);
  });

  it('usuário só "confirma" (pede aprovação) a parcela dele; não muda status', async () => {
    const { pedidoId, parcelas } = await novoPedido(2);
    expect((await api(`/api/loja/parcelas/${parcelas[0].id}/confirmar`, { method: 'PUT', token: user.token })).status).toBe(200);
    const outro = await cadastrarMilitar({ trigrama: 'OUT' });
    expect((await api(`/api/loja/parcelas/${parcelas[0].id}/confirmar`, { method: 'PUT', token: outro.token })).status).toBe(404);
    expect((await estado(pedidoId)).parcelas[0].status).toBe('pendente');
  });
});

describe('estoque', () => {
  it('não vende além do estoque da variação (e não deixa estoque negativo)', async () => {
    const r = await api('/api/loja/admin/produtos', {
      token: superToken,
      body: { nome: 'Boné', preco: 40, variacoes: [{ tamanho: 'U', estoque: 1 }] },
    });
    const prod = (await api('/api/loja/admin/produtos', { token: superToken })).body.find((p: any) => p.id === r.body.id);
    const variacao = prod.variacoes[0];
    const pedir = (quantidade: number) => api('/api/loja/pedidos', {
      token: user.token, body: { itens: [{ produto_id: r.body.id, variacao_id: variacao.id, quantidade }], metodo: 'pix' },
    });
    expect((await pedir(2)).status).toBe(400);
    expect((await pedir(1)).status).toBe(201);
    expect((await pedir(1)).status).toBe(400);
    const v = await env.DB.prepare('SELECT estoque FROM loja_variacoes WHERE id = ?').bind(variacao.id).first<{ estoque: number }>();
    expect(v!.estoque).toBe(0);
  });
});
