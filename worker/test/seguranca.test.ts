// FASE DE SEGURANÇA, parte 2 — testes das correções (OWASP: A01 controle de acesso, A04 design
// inseguro, A05 configuração, A07 autenticação, A09 logging). Cada bloco cita a correção.
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import {
  api, loginSuper, criarAdmin, cadastrarMilitar, criarAssinante, pedidoCantina, enviarComprovante,
} from './helpers/fixtures';
import worker from '../src/index';
import { origensPermitidas } from '../src/lib/cors';
import { detectarTipo } from '../src/lib/arquivo';

const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d];
const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34];
const HTML = [...new TextEncoder().encode('<html><script>alert(1)</script></html>')];

function form(campo: string, bytes: number[], nome: string, tipo: string, extra: Record<string, string> = {}) {
  const f = new FormData();
  for (const [k, v] of Object.entries(extra)) f.append(k, v);
  f.append(campo, new File([new Uint8Array(bytes)], nome, { type: tipo }));
  return f;
}

async function auditoria(acao: string) {
  const { results } = await env.DB.prepare('SELECT * FROM audit_log WHERE acao = ? ORDER BY created_at').bind(acao).all<any>();
  return results;
}

/** POST com corpo cru (o helper api() sempre serializa JSON válido). */
async function apiCru(path: string, corpo: string | undefined) {
  const req = new Request(`https://senta-pua.test${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: corpo });
  const ctx = createExecutionContext();
  const res = await worker.fetch(req, env, ctx);
  const texto = await res.text();
  await waitOnExecutionContext(ctx);
  return { status: res.status, body: texto ? JSON.parse(texto) : null };
}

let seqCad = 0;
function corpoCadastro(trigrama: string) {
  seqCad++;
  return {
    email: `rl${seqCad}-${Date.now()}@teste.local`, senha: 'senha123', trigrama,
    saram: String(7000000 + seqCad), whatsapp: '61999990000', categoria: 'graduado', aceite_lgpd: true,
  };
}

describe('1 — userAuthMiddleware carrega o usuário do banco a cada requisição', () => {
  it('desativar corta o token na hora; reativar devolve o acesso', async () => {
    const sup = await loginSuper();
    const u = await cadastrarMilitar({ trigrama: 'RTV' });
    await api(`/api/usuarios/admin/${u.id}/desativar`, { method: 'PUT', token: sup.token });
    expect((await api('/api/usuarios/me', { token: u.token })).status).toBe(401);
    await api(`/api/usuarios/admin/${u.id}/ativar`, { method: 'PUT', token: sup.token });
    expect((await api('/api/usuarios/me', { token: u.token })).status).toBe(200);
  });

  it('após renomear, o token antigo passa a usar o trigrama ATUAL (vê os próprios pedidos)', async () => {
    const sup = await loginSuper();
    const u = await cadastrarMilitar({ trigrama: 'OLD' });
    const ped = await pedidoCantina(u.token, 'fiado');
    await api(`/api/usuarios/admin/${u.id}`, { method: 'PUT', token: sup.token, body: { trigrama: 'NEW' } });
    const r = await api('/api/usuarios/me/extrato', { token: u.token });
    expect(r.status).toBe(200);
    expect(r.body.guloseimas.map((p: any) => p.id)).toContain(ped.body.pedido_id);
  });
});

describe('2 — login não revela conta desativada nem e-mail existente', () => {
  it('conta desativada com a senha certa => 403 com a mensagem; senha errada => 401 genérico e conta no rate limit', async () => {
    const sup = await loginSuper();
    const u = await cadastrarMilitar({ trigrama: 'LGD' });
    await api(`/api/usuarios/admin/${u.id}/desativar`, { method: 'PUT', token: sup.token });

    const certa = await api('/api/usuarios/login', { body: { email: u.email, senha: u.senha } });
    expect(certa.status).toBe(403);
    expect(certa.body.error).toMatch(/desativada/i);

    const errada = await api('/api/usuarios/login', { body: { email: u.email, senha: 'errada-123' } });
    expect(errada.status).toBe(401);
    const inexistente = await api('/api/usuarios/login', { body: { email: 'ninguem@teste.local', senha: 'errada-123' } });
    expect(inexistente.status).toBe(401);
    expect(errada.body).toEqual(inexistente.body);

    const n = await env.DB.prepare("SELECT COUNT(*) as n FROM rate_limit_attempts WHERE acao = 'user_login' AND key LIKE ?")
      .bind(`%:${u.email}`).first<{ n: number }>();
    expect(n!.n).toBe(1);
  });

  it('admin inexistente e senha errada dão a mesma resposta', async () => {
    const a = await api('/api/auth/login', { body: { email: 'nao-existe@teste.local', senha: 'qualquer' } });
    const b = await api('/api/auth/login', { body: { email: env.ADMIN_EMAIL, senha: 'qualquer' } });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body).toEqual(b.body);
  });
});

describe('3 — JSON inválido => 400 genérico; nada de mensagem de erro para o cliente', () => {
  it.each([
    ['/api/usuarios/login'],
    ['/api/usuarios/cadastro'],
    ['/api/auth/login'],
  ])('%s com corpo vazio ou JSON quebrado => 400 { error: "Requisição inválida" }', async (path) => {
    for (const corpo of [undefined, '{nao é json']) {
      const r = await apiCru(path, corpo);
      expect(r.status).toBe(400);
      expect(r.body).toEqual({ error: 'Requisição inválida' });
    }
  });

  it('rota admin da loja com JSON inválido não devolve err.message', async () => {
    const sup = await loginSuper();
    const r = await api('/api/loja/admin/produtos', { method: 'POST', token: sup.token, headers: { 'Content-Type': 'application/json' } });
    expect(r.status).toBe(400);
    expect(JSON.stringify(r.body)).not.toMatch(/Erro interno:|JSON|Unexpected/);
  });
});

describe('4 — rotas públicas de pedido devolvem só o necessário', () => {
  it('GET /api/pedidos/:id', async () => {
    const u = await cadastrarMilitar({ trigrama: 'PUB' });
    const ped = await pedidoCantina(u.token, 'pix');
    const r = await api(`/api/pedidos/${ped.body.pedido_id}`);
    expect(r.status).toBe(200);
    expect(Object.keys(r.body).sort()).toEqual(['created_at', 'id', 'metodo_pagamento', 'paid_at', 'status', 'total']);
  });

  it('GET /api/loja/pedidos/:id', async () => {
    const sup = await loginSuper();
    const prod = await api('/api/loja/admin/produtos', { token: sup.token, body: { nome: 'Boné', preco: 40 } });
    const u = await cadastrarMilitar({ trigrama: 'PUL' });
    const ped = await api('/api/loja/pedidos', { token: u.token, body: { itens: [{ produto_id: prod.body.id, quantidade: 1 }], metodo: 'pix' } });
    expect(ped.status).toBe(201);
    const r = await api(`/api/loja/pedidos/${ped.body.pedido_id}`);
    expect(r.status).toBe(200);
    expect(Object.keys(r.body).sort()).toEqual(['created_at', 'id', 'metodo_pagamento', 'paid_at', 'parcelas', 'status', 'total']);
  });
});

describe('5 — comprovantes privados: GET /api/comprovantes/:id/imagem', () => {
  async function cenario() {
    const sup = await loginSuper();
    const dono = await cadastrarMilitar({ trigrama: 'DON' });
    const outro = await cadastrarMilitar({ trigrama: 'OUT' });
    const ped = await pedidoCantina(dono.token, 'pix');
    const c = await enviarComprovante(dono.token, 'cantina', ped.body.pedido_id);
    expect(c.status).toBe(201);
    return { sup, dono, outro, comp: c.body };
  }

  it('upload devolve a URL protegida; a URL pública antiga responde 404', async () => {
    const { comp } = await cenario();
    expect(comp.imagem_url).toBe(`/api/comprovantes/${comp.id}/imagem`);
    expect(comp.imagem_pdf).toBe(false);
    const row = await env.DB.prepare('SELECT imagem_key FROM comprovantes WHERE id = ?').bind(comp.id).first<{ imagem_key: string }>();
    expect(row!.imagem_key).toMatch(/^comprovantes\/[0-9a-f-]{36}\.jpg$/);
    expect((await api(`/api/images/${row!.imagem_key}`)).status).toBe(404);
  });

  it('admin e dono recebem o arquivo com cabeçalhos privados; outro usuário 404; sem login 401', async () => {
    const { sup, dono, outro, comp } = await cenario();
    for (const token of [sup.token, dono.token]) {
      const r = await api(comp.imagem_url, { token });
      expect(r.status).toBe(200);
      expect(r.headers.get('Content-Type')).toBe('image/jpeg');
      expect(r.headers.get('Cache-Control')).toBe('private, no-store');
      expect(r.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(r.headers.get('Content-Disposition')).toBe('inline');
    }
    expect((await api(comp.imagem_url, { token: outro.token })).status).toBe(404);
    expect((await api(comp.imagem_url)).status).toBe(401);
  });

  it('linhas antigas (imagem_url pública no banco) também saem com a URL protegida nas listas', async () => {
    const { sup, dono, comp } = await cenario();
    await env.DB.prepare("UPDATE comprovantes SET imagem_url = '/api/images/' || imagem_key WHERE id = ?").bind(comp.id).run();
    const adm = await api('/api/comprovantes', { token: sup.token });
    expect(adm.body.items[0].imagem_url).toBe(`/api/comprovantes/${comp.id}/imagem`);
    const me = await api('/api/comprovantes/me', { token: dono.token });
    expect(me.body[0].imagem_url).toBe(`/api/comprovantes/${comp.id}/imagem`);
  });

  it('admin com escopo cafe_graduado: só comprovante do café dos graduados', async () => {
    const { sup, comp } = await cenario();
    const esc = await criarAdmin(sup.token, { escopo: 'cafe_graduado' });
    expect((await api(comp.imagem_url, { token: esc.token })).status).toBe(404); // cantina

    const grad = await cadastrarMilitar({ trigrama: 'GRA', categoria: 'graduado' });
    const ass = await criarAssinante(sup.token, 'GRA', { valor: 20 });
    const cc = await enviarComprovante(grad.token, 'cafe', ass.primeira_cobranca.id);
    expect(cc.status).toBe(201);
    expect((await api(cc.body.imagem_url, { token: esc.token })).status).toBe(200);
  });

  it('PDF é aceito no comprovante e marcado como imagem_pdf', async () => {
    const u = await cadastrarMilitar({ trigrama: 'PDF' });
    const ped = await pedidoCantina(u.token, 'pix');
    const r = await api('/api/comprovantes', {
      method: 'POST', token: u.token,
      form: form('file', PDF, 'c.pdf', 'application/pdf', { origem: 'cantina', referencia_id: ped.body.pedido_id }),
    });
    expect(r.status).toBe(201);
    expect(r.body.imagem_pdf).toBe(true);
    const img = await api(r.body.imagem_url, { token: u.token });
    expect(img.headers.get('Content-Type')).toBe('application/pdf');
  });
});

describe('6 — uploads validados pelo conteúdo', () => {
  it('detectarTipo reconhece as assinaturas', () => {
    expect(detectarTipo(new Uint8Array(JPEG))).toBe('jpeg');
    expect(detectarTipo(new Uint8Array(PNG))).toBe('png');
    expect(detectarTipo(new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]))).toBe('webp');
    expect(detectarTipo(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]))).toBe('gif');
    expect(detectarTipo(new Uint8Array(PDF))).toBe('pdf');
    expect(detectarTipo(new Uint8Array(HTML))).toBeNull();
    expect(detectarTipo(new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x41, 0x56, 0x49, 0x20]))).toBeNull(); // RIFF AVI
  });

  it('HTML com nome .jpg e tipo image/jpeg é recusado (admin, comprovante, foto)', async () => {
    const sup = await loginSuper();
    expect((await api('/api/images/upload', { method: 'POST', token: sup.token, form: form('file', HTML, 'x.jpg', 'image/jpeg') })).status).toBe(400);
    expect((await api('/api/inventario/upload', { method: 'POST', token: sup.token, form: form('file', HTML, 'x.png', 'image/png') })).status).toBe(400);

    const u = await cadastrarMilitar({ trigrama: 'UPL' });
    expect((await api('/api/usuarios/me/foto', { method: 'POST', token: u.token, form: form('foto', HTML, 'x.jpg', 'image/jpeg') })).status).toBe(400);
    // foto não aceita PDF
    expect((await api('/api/usuarios/me/foto', { method: 'POST', token: u.token, form: form('foto', PDF, 'x.jpg', 'image/jpeg') })).status).toBe(400);
    const ped = await pedidoCantina(u.token, 'pix');
    const c = await api('/api/comprovantes', {
      method: 'POST', token: u.token,
      form: form('file', HTML, 'c.jpg', 'image/jpeg', { origem: 'cantina', referencia_id: ped.body.pedido_id }),
    });
    expect(c.status).toBe(400);
  });

  it('tipo e extensão gravados vêm do conteúdo (PNG enviado como .jpg/text/html)', async () => {
    const sup = await loginSuper();
    const r = await api('/api/images/upload', { method: 'POST', token: sup.token, form: form('file', PNG, 'foto.jpg', 'text/html') });
    expect(r.status).toBe(200);
    expect(r.body.key).toMatch(/^produtos\/[0-9a-f-]{36}\.png$/);
    const obj = await env.IMAGES.head(r.body.key);
    expect(obj!.httpMetadata!.contentType).toBe('image/png');

    const pub = await api(r.body.url);
    expect(pub.status).toBe(200);
    expect(pub.headers.get('Content-Type')).toBe('image/png');
    expect(pub.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('arquivo acima do limite é recusado', async () => {
    const sup = await loginSuper();
    const grande = new Array(5 * 1024 * 1024 + 1).fill(0);
    grande.splice(0, JPEG.length, ...JPEG);
    expect((await api('/api/images/upload', { method: 'POST', token: sup.token, form: form('file', grande, 'g.jpg', 'image/jpeg') })).status).toBe(400);
  });

  it('GET /api/images só serve imagem: objeto não-imagem => 404; objeto antigo sem tipo mas com bytes de imagem => 200', async () => {
    await env.IMAGES.put('produtos/malicioso.html', new Uint8Array(HTML), { httpMetadata: { contentType: 'text/html' } });
    expect((await api('/api/images/produtos/malicioso.html')).status).toBe(404);
    await env.IMAGES.put('produtos/disfarcado.jpg', new Uint8Array(HTML), { httpMetadata: { contentType: '' } });
    expect((await api('/api/images/produtos/disfarcado.jpg')).status).toBe(404);

    await env.IMAGES.put('produtos/antigo.jpg', new Uint8Array(JPEG));
    const r = await api('/api/images/produtos/antigo.jpg');
    expect(r.status).toBe(200);
    expect(r.headers.get('Content-Type')).toBe('image/jpeg');
    expect(r.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });
});

describe('7 — cabeçalhos de segurança e CORS', () => {
  it('respostas da API trazem os cabeçalhos', async () => {
    const r = await api('/api/health');
    expect(r.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(r.headers.get('X-Frame-Options')).toBe('DENY');
    expect(r.headers.get('Referrer-Policy')).toBe('no-referrer');
    expect(r.headers.get('Strict-Transport-Security')).toMatch(/max-age=\d+/);
    expect(r.headers.get('Content-Security-Policy')).toBe("frame-ancestors 'none'");
    // imagens públicas são carregadas pelo app em outro domínio
    expect(r.headers.get('Cross-Origin-Resource-Policy')).toBe('cross-origin');
  });

  it('erro 500/400 também leva os cabeçalhos', async () => {
    const r = await api('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    expect(r.status).toBe(400);
    expect(r.headers.get('X-Frame-Options')).toBe('DENY');
  });

  it('CORS: origem permitida recebe ACAO; origem estranha não', async () => {
    const ok = await api('/api/health', { headers: { Origin: 'http://localhost:5173' } });
    expect(ok.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
    const ruim = await api('/api/health', { headers: { Origin: 'https://evil.example' } });
    expect(ruim.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('origensPermitidas nunca inclui "undefined"/vazio', () => {
    for (const v of [undefined, null, '', '   ']) {
      const l = origensPermitidas(v as any);
      expect(l).not.toContain(undefined);
      expect(l).not.toContain('undefined');
      expect(l).not.toContain('');
      expect(l).toEqual(['https://app-senta-pua.pages.dev', 'http://localhost:5173']);
    }
    expect(origensPermitidas('https://app.exemplo.com/')).toEqual(['https://app.exemplo.com', 'https://app-senta-pua.pages.dev', 'http://localhost:5173']);
  });
});

describe('9 — rate limit no cadastro e no envio de comprovante', () => {
  const contar = async (sql: string, ...binds: unknown[]): Promise<number> =>
    ((await env.DB.prepare(sql).bind(...binds).first<{ n: number }>())?.n ?? 0);

  // Limites atuais: 40 cadastros concluídos e 120 tentativas por IP por hora (comporta um mutirão
  // do esquadrão inteiro saindo pela mesma internet). Os testes pré-carregam as marcas no banco
  // para não fazer dezenas de cadastros reais (cada um roda PBKDF2).
  const marcar = (acao: string, ip: string, n: number) =>
    env.DB.batch(Array.from({ length: n }, () =>
      env.DB.prepare('INSERT INTO rate_limit_attempts (key, acao) VALUES (?, ?)').bind(ip, acao)));

  it('cadastro concluído conta no limite; ao atingir 40 na hora => 429; outro IP segue', async () => {
    const ip = '198.51.100.10';
    const r = await api('/api/usuarios/cadastro', { body: corpoCadastro('QAA'), headers: { 'CF-Connecting-IP': ip } });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(await contar("SELECT COUNT(*) as n FROM rate_limit_attempts WHERE acao = 'cadastro_ok' AND key = ?", ip)).toBe(1);
    await marcar('cadastro_ok', ip, 39);
    const bloqueado = await api('/api/usuarios/cadastro/visitante', { body: { ...corpoCadastro('QZZ'), esquadrao_origem: '2/10' }, headers: { 'CF-Connecting-IP': ip } });
    expect(bloqueado.status).toBe(429);
    const outroIp = await api('/api/usuarios/cadastro', { body: corpoCadastro('QYY'), headers: { 'CF-Connecting-IP': '198.51.100.11' } });
    expect(outroIp.status).toBe(201);
  });

  it('tentativas falhas também contam (limite de 120 por hora)', async () => {
    const ip = '198.51.100.20';
    const falha = await api('/api/usuarios/cadastro', { body: { email: 'x' }, headers: { 'CF-Connecting-IP': ip } });
    expect(falha.status).toBe(400);
    expect(await contar("SELECT COUNT(*) as n FROM rate_limit_attempts WHERE acao = 'cadastro_tentativa' AND key = ?", ip)).toBe(1);
    await marcar('cadastro_tentativa', ip, 119);
    expect((await api('/api/usuarios/cadastro', { body: corpoCadastro('QWW'), headers: { 'CF-Connecting-IP': ip } })).status).toBe(429);
  });

  it('21º comprovante do usuário no dia => 429', async () => {
    const u = await cadastrarMilitar({ trigrama: 'RLC' });
    const ped = await pedidoCantina(u.token, 'pix');
    // prepara 20 envios nas últimas 24h (a API bloqueia duplicado aguardando, então insere direto)
    await env.DB.batch(Array.from({ length: 20 }, () =>
      env.DB.prepare("INSERT INTO rate_limit_attempts (key, acao) VALUES (?, 'comprovante_envio')").bind(`usuario:${u.id}`)));
    const r = await enviarComprovante(u.token, 'cantina', ped.body.pedido_id);
    expect(r.status).toBe(429);
  });

  it('cada envio aceito conta no limite', async () => {
    const u = await cadastrarMilitar({ trigrama: 'RLD' });
    const ped = await pedidoCantina(u.token, 'pix');
    expect((await enviarComprovante(u.token, 'cantina', ped.body.pedido_id)).status).toBe(201);
    const n = await env.DB.prepare("SELECT COUNT(*) as n FROM rate_limit_attempts WHERE acao = 'comprovante_envio' AND key = ?")
      .bind(`usuario:${u.id}`).first<{ n: number }>();
    expect(n!.n).toBe(1);
  });
});

describe('10 — PUT /api/admins/me/senha exige a senha atual', () => {
  it('sem senha_atual 400; errada 403; certa 200 + audit sem a senha; login com a nova', async () => {
    const sup = await loginSuper();
    const adm = await criarAdmin(sup.token);
    expect((await api('/api/admins/me/senha', { method: 'PUT', token: adm.token, body: { senha: 'NovaSenha999' } })).status).toBe(400);
    expect((await api('/api/admins/me/senha', { method: 'PUT', token: adm.token, body: { senha_atual: 'errada', senha: 'NovaSenha999' } })).status).toBe(403);
    const ok = await api('/api/admins/me/senha', { method: 'PUT', token: adm.token, body: { senha_atual: adm.senha, senha: 'NovaSenha999' } });
    expect(ok.status).toBe(200);

    const linhas = await auditoria('trocar_propria_senha');
    expect(linhas.length).toBe(1);
    expect(linhas[0].admin_email).toBe(adm.email);
    expect(JSON.stringify(linhas[0])).not.toMatch(/NovaSenha999|SenhaAdmin123/);
    expect((await api('/api/auth/login', { body: { email: adm.email, senha: 'NovaSenha999' } })).status).toBe(200);
  });
});

describe('11 — auditoria de login admin e de negação de escopo', () => {
  it('login ok e falha registrados com e-mail e IP do CF-Connecting-IP; nunca a senha', async () => {
    const headers = { 'CF-Connecting-IP': '203.0.113.7', 'X-Forwarded-For': '6.6.6.6' };
    expect((await api('/api/auth/login', { body: { email: env.ADMIN_EMAIL, senha: 'SenhaErrada!' }, headers })).status).toBe(401);
    expect((await api('/api/auth/login', { body: { email: env.ADMIN_EMAIL, senha: env.ADMIN_SENHA }, headers })).status).toBe(200);

    const falhas = await auditoria('login_admin_falha');
    const oks = await auditoria('login_admin_ok');
    expect(falhas.length).toBe(1);
    expect(oks.length).toBe(1);
    for (const l of [...falhas, ...oks]) {
      expect(l.admin_email).toBe(env.ADMIN_EMAIL);
      expect(l.ip_address).toBe('203.0.113.7');
      expect(JSON.stringify(l)).not.toMatch(/SenhaErrada|SenhaSuper123|6\.6\.6\.6/);
    }
  });

  it('negação de escopo vira 1 registro por admin+caminho a cada 10 min', async () => {
    const sup = await loginSuper();
    const esc = await criarAdmin(sup.token, { escopo: 'cafe_graduado' });
    for (let i = 0; i < 3; i++) expect((await api('/api/pedidos', { token: esc.token })).status).toBe(403);
    expect((await api('/api/admins', { token: esc.token })).status).toBe(403);
    // negação dentro da rota (sala do café diferente)
    for (let i = 0; i < 2; i++) expect((await api('/api/cafe/admin/assinantes?tipo=oficial', { token: esc.token })).status).toBe(403);

    const linhas = await auditoria('acesso_negado_escopo');
    const caminhos = linhas.map((l) => JSON.parse(l.dados_depois)).map((d) => `${d.metodo} ${d.caminho}`).sort();
    expect(caminhos).toEqual(['GET /api/admins', 'GET /api/cafe/admin/assinantes', 'GET /api/pedidos']);
    expect(linhas.every((l) => l.admin_email === esc.email)).toBe(true);
  });
});

describe('12 — recepcionista/homenagem: 404 para usuário inexistente; audit da recepcionista', () => {
  it('404 quando não existe', async () => {
    const sup = await loginSuper();
    expect((await api('/api/usuarios/admin/999999/recepcionista', { method: 'PUT', token: sup.token, body: { is_recepcionista: 1 } })).status).toBe(404);
    expect((await api('/api/usuarios/admin/999999/homenagem', { method: 'PUT', token: sup.token, body: { niver_titulo: 'x' } })).status).toBe(404);
  });

  it('alterar recepcionista registra na auditoria', async () => {
    const sup = await loginSuper();
    const u = await cadastrarMilitar({ trigrama: 'REC' });
    const r = await api(`/api/usuarios/admin/${u.id}/recepcionista`, { method: 'PUT', token: sup.token, body: { is_recepcionista: 1 } });
    expect(r.status).toBe(200);
    const l = await auditoria('alterar_recepcionista_usuario');
    expect(l.length).toBe(1);
    expect(l[0].entidade_id).toBe(String(u.id));
    expect(JSON.parse(l[0].dados_depois)).toEqual({ is_recepcionista: 1 });
  });
});
