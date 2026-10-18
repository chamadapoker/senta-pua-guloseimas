// Caso 1 — autenticação de admin (OWASP A01/A07): o autorizado entra, o resto recebe 401.
import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import { sign } from '../src/lib/jwt';
import { api, loginSuper, criarAdmin, cadastrarMilitar } from './helpers/fixtures';

// Rotas admin de módulos diferentes (cada uma protegida por authMiddleware)
const ROTAS_ADMIN = [
  '/api/auth/me',
  '/api/admins',
  '/api/auditoria',
  '/api/admin/painel',
  '/api/clientes',
  '/api/produtos/todos',
  '/api/loja/admin/pedidos',
  '/api/cafe/admin/assinantes',
  '/api/usuarios/admin/lista',
  '/api/comprovantes',
];

function b64url(obj: unknown): string {
  return btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

describe('auth admin', () => {
  it('login do super admin (bootstrap via ADMIN_EMAIL/ADMIN_SENHA) e acesso às rotas admin', async () => {
    const { token } = await loginSuper();
    const me = await api('/api/auth/me', { token });
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ email: env.ADMIN_EMAIL, role: 'super_admin', escopo: null });
    expect(me.body.senha_hash).toBeUndefined();
    for (const rota of ROTAS_ADMIN) {
      const r = await api(rota, { token });
      expect(r.status, rota).toBe(200);
    }
  });

  it('senha errada e email inexistente => 401 (mesma mensagem, sem enumeração)', async () => {
    await loginSuper(); // garante que o super existe
    const errada = await api('/api/auth/login', { body: { email: env.ADMIN_EMAIL, senha: 'errada' } });
    const inexistente = await api('/api/auth/login', { body: { email: 'ninguem@teste.local', senha: 'qualquer' } });
    expect(errada.status).toBe(401);
    expect(inexistente.status).toBe(401);
    expect(errada.body.error).toBe(inexistente.body.error);
    expect(errada.body.token).toBeUndefined();
  });

  it('login: muitas tentativas erradas => 429 (rate limit)', async () => {
    await loginSuper();
    for (let i = 0; i < 5; i++) {
      expect((await api('/api/auth/login', { body: { email: env.ADMIN_EMAIL, senha: 'errada' } })).status).toBe(401);
    }
    const bloqueado = await api('/api/auth/login', { body: { email: env.ADMIN_EMAIL, senha: env.ADMIN_SENHA } });
    expect(bloqueado.status).toBe(429);
  });

  it('sem token => 401 em todas as rotas admin', async () => {
    for (const rota of ROTAS_ADMIN) {
      const r = await api(rota);
      expect(r.status, rota).toBe(401);
    }
  });

  it('Authorization sem "Bearer " => 401', async () => {
    const { token } = await loginSuper();
    const r = await api('/api/admins', { headers: { Authorization: token } });
    expect(r.status).toBe(401);
  });

  it('token de USUÁRIO numa rota admin => 401', async () => {
    const u = await cadastrarMilitar({ trigrama: 'USR' });
    // o token do usuário é válido para as rotas dele...
    expect((await api('/api/usuarios/me', { token: u.token })).status).toBe(200);
    // ...mas nunca vale como admin
    for (const rota of ROTAS_ADMIN) {
      const r = await api(rota, { token: u.token });
      expect(r.status, rota).toBe(401);
    }
  });

  it('token de ADMIN não vale como usuário', async () => {
    const { token } = await loginSuper();
    expect((await api('/api/usuarios/me', { token })).status).toBe(401);
    expect((await api('/api/usuarios/me/extrato', { token })).status).toBe(401);
  });

  it('admin desativado perde acesso na hora, com o mesmo token', async () => {
    const sup = await loginSuper();
    const adm = await criarAdmin(sup.token);
    expect((await api('/api/admins', { token: adm.token })).status).toBe(200);

    const off = await api(`/api/admins/${adm.id}`, { method: 'PUT', token: sup.token, body: { ativo: false } });
    expect(off.status).toBe(200);

    expect((await api('/api/admins', { token: adm.token })).status).toBe(401);
    expect((await api('/api/auth/me', { token: adm.token })).status).toBe(401);
    // e não consegue logar de novo
    expect((await api('/api/auth/login', { body: { email: adm.email, senha: adm.senha } })).status).toBe(401);

    // reativado: o mesmo token volta a valer (o estado é conferido no banco a cada requisição)
    await api(`/api/admins/${adm.id}`, { method: 'PUT', token: sup.token, body: { ativo: true } });
    expect((await api('/api/admins', { token: adm.token })).status).toBe(200);
  });

  it('admin excluído perde acesso na hora', async () => {
    const sup = await loginSuper();
    const adm = await criarAdmin(sup.token);
    expect((await api(`/api/admins/${adm.id}`, { method: 'DELETE', token: sup.token })).status).toBe(200);
    expect((await api('/api/admins', { token: adm.token })).status).toBe(401);
  });

  it('rebaixado de super_admin perde os poderes de super na hora', async () => {
    const sup = await loginSuper();
    const outroSuper = await criarAdmin(sup.token, { role: 'super_admin' });
    const novo = { email: 'x1@teste.local', senha: 'SenhaAdmin123', nome: 'X1' };
    expect((await api('/api/admins', { token: outroSuper.token, body: novo })).status).toBe(201);

    await api(`/api/admins/${outroSuper.id}`, { method: 'PUT', token: sup.token, body: { role: 'admin' } });
    const r = await api('/api/admins', { token: outroSuper.token, body: { ...novo, email: 'x2@teste.local' } });
    expect(r.status).toBe(403);
  });

  it('admin comum não cria/edita/exclui admins (403); super admin pode', async () => {
    const sup = await loginSuper();
    const adm = await criarAdmin(sup.token);
    const body = { email: 'novo@teste.local', senha: 'SenhaAdmin123', nome: 'Novo' };
    expect((await api('/api/admins', { token: adm.token, body })).status).toBe(403);
    expect((await api(`/api/admins/${sup.id}`, { method: 'PUT', token: adm.token, body: { ativo: false } })).status).toBe(403);
    expect((await api(`/api/admins/${sup.id}`, { method: 'DELETE', token: adm.token })).status).toBe(403);
    expect((await api('/api/admins', { token: sup.token, body })).status).toBe(201);
  });

  it('token com payload adulterado (assinatura antiga) => 401', async () => {
    const adm = await criarAdmin((await loginSuper()).token);
    const [h, p, s] = adm.token.split('.');
    const payload = JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/')));
    const forjado = `${h}.${b64url({ ...payload, role: 'super_admin', id: 'outro-id' })}.${s}`;
    expect((await api('/api/admins', { token: forjado })).status).toBe(401);
  });

  it('token com assinatura trocada => 401', async () => {
    const { token } = await loginSuper();
    const [h, p] = token.split('.');
    expect((await api('/api/admins', { token: `${h}.${p}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA` })).status).toBe(401);
    expect((await api('/api/admins', { token: `${h}.${p}` })).status).toBe(401);
    expect((await api('/api/admins', { token: 'lixo' })).status).toBe(401);
  });

  it('alg "none" => 401', async () => {
    const { id } = await loginSuper();
    const now = Math.floor(Date.now() / 1000);
    const semAssinatura = `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url({ tipo: 'admin', id, role: 'super_admin', iat: now, exp: now + 3600 })}.`;
    expect((await api('/api/admins', { token: semAssinatura })).status).toBe(401);
  });

  it('token assinado com outro segredo => 401', async () => {
    const { id } = await loginSuper();
    const t = await sign({ tipo: 'admin', id, email: env.ADMIN_EMAIL, role: 'super_admin' }, 'outro-segredo');
    expect((await api('/api/admins', { token: t })).status).toBe(401);
  });

  it('token expirado => 401 (e o mesmo payload dentro da validade => 200)', async () => {
    const { id } = await loginSuper();
    const payload = { tipo: 'admin', id, email: env.ADMIN_EMAIL, role: 'super_admin' };
    const valido = await sign(payload, env.JWT_SECRET, 1);
    const expirado = await sign(payload, env.JWT_SECRET, -1);
    expect((await api('/api/admins', { token: valido })).status).toBe(200);
    expect((await api('/api/admins', { token: expirado })).status).toBe(401);
  });

  it('token bem assinado mas sem id de admin existente => 401', async () => {
    await loginSuper();
    const t = await sign({ tipo: 'admin', id: 'nao-existe', role: 'super_admin' }, env.JWT_SECRET);
    expect((await api('/api/admins', { token: t })).status).toBe(401);
    const semId = await sign({ tipo: 'admin', role: 'super_admin' }, env.JWT_SECRET);
    expect((await api('/api/admins', { token: semId })).status).toBe(401);
  });

  it('lista de admins nunca devolve hash de senha', async () => {
    const { token } = await loginSuper();
    const r = await api('/api/admins', { token });
    expect(r.status).toBe(200);
    for (const a of r.body) expect(a.senha_hash).toBeUndefined();
  });
});
