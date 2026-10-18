// Helpers de requisição e fixtures. Tudo passa pela API real do Worker (o export default de
// src/index.ts, rodando no workerd com o D1 local), exceto onde o teste precisa preparar um estado
// que a API não cria (aí usa env.DB direto, sempre comentado).
//
// Por que worker.fetch(...) e não SELF.fetch(...): no pool 0.8.x o SELF.fetch fica mais lento a cada
// chamada (quadrático) e estoura a pilha depois de ~1000 requisições na mesma execução; chamar o
// handler exportado com createExecutionContext/waitOnExecutionContext é o caminho "unit style" da
// própria documentação e executa exatamente o mesmo código (Hono + middlewares + rotas).
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { expect } from 'vitest';
import worker from '../../src/index';

export const BASE = 'https://senta-pua.test';

export type Resp<T = any> = { status: number; body: T; headers: Headers };

type Opcoes = {
  method?: string;
  token?: string | null;
  body?: unknown;
  form?: FormData;
  headers?: Record<string, string>;
};

export async function api<T = any>(path: string, op: Opcoes = {}): Promise<Resp<T>> {
  const headers: Record<string, string> = { ...(op.headers ?? {}) };
  if (op.token) headers.Authorization = `Bearer ${op.token}`;
  let body: BodyInit | undefined;
  if (op.form) {
    body = op.form;
  } else if (op.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(op.body);
  }
  const req = new Request(`${BASE}${path}`, { method: op.method ?? (body ? 'POST' : 'GET'), headers, body });
  const ctx = createExecutionContext();
  const res = await worker.fetch(req, env, ctx);
  const texto = await res.text();
  await waitOnExecutionContext(ctx);
  let json: unknown = texto;
  try { json = texto ? JSON.parse(texto) : null; } catch { /* resposta não-JSON fica como texto */ }
  return { status: res.status, body: json as T, headers: res.headers };
}

// ---------- Admins ----------

/** Login do super admin criado pelo bootstrap (ADMIN_EMAIL/ADMIN_SENHA do ambiente de teste). */
export async function loginSuper(): Promise<{ token: string; id: string }> {
  const r = await api('/api/auth/login', { body: { email: env.ADMIN_EMAIL, senha: env.ADMIN_SENHA } });
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  return { token: r.body.token, id: r.body.admin.id };
}

let seqAdmin = 0;

/** Super admin cria um admin (com ou sem escopo) e o admin faz login. */
export async function criarAdmin(
  superToken: string,
  op: { escopo?: string | null; role?: 'admin' | 'super_admin'; senha?: string } = {},
): Promise<{ token: string; id: string; email: string; senha: string }> {
  seqAdmin++;
  const email = `admin${seqAdmin}-${Date.now()}@teste.local`;
  const senha = op.senha ?? 'SenhaAdmin123';
  const c = await api('/api/admins', {
    token: superToken,
    body: { email, senha, nome: `Admin ${seqAdmin}`, role: op.role ?? 'admin', escopo: op.escopo ?? null },
  });
  expect(c.status, JSON.stringify(c.body)).toBe(201);
  const l = await api('/api/auth/login', { body: { email, senha } });
  expect(l.status, JSON.stringify(l.body)).toBe(200);
  return { token: l.body.token, id: c.body.id, email, senha };
}

// ---------- Usuários (militares/visitantes) ----------

let seqUser = 0;

export type Usuario = { token: string; id: number; trigrama: string; email: string; senha: string; saram: string };

type DadosCadastro = {
  trigrama: string;
  categoria?: 'oficial' | 'graduado' | 'praca';
  saram?: string;
  email?: string;
  senha?: string;
  data_nascimento?: string | null;
};

function dadosCadastro(d: DadosCadastro) {
  seqUser++;
  return {
    email: d.email ?? `${d.trigrama.toLowerCase()}${seqUser}@teste.local`,
    senha: d.senha ?? 'senha123',
    trigrama: d.trigrama,
    saram: d.saram ?? String(1000000 + seqUser * 7 + Math.floor(Math.random() * 1000) * 100000),
    whatsapp: '61999990000',
    categoria: d.categoria ?? 'graduado',
    aceite_lgpd: true,
    data_nascimento: d.data_nascimento ?? null,
  };
}

/** Cadastro público de militar (POST /api/usuarios/cadastro). */
export async function cadastrarMilitar(d: DadosCadastro): Promise<Usuario> {
  const body = dadosCadastro(d);
  const r = await api('/api/usuarios/cadastro', { body });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return { token: r.body.token, id: r.body.user.id, trigrama: body.trigrama, email: body.email, senha: body.senha, saram: body.saram };
}

/** Cadastro público de visitante (POST /api/usuarios/cadastro/visitante). */
export async function cadastrarVisitante(d: DadosCadastro & { esquadrao_origem?: string }): Promise<Usuario> {
  const body = { ...dadosCadastro(d), esquadrao_origem: d.esquadrao_origem ?? '2/10 GAV' };
  const r = await api('/api/usuarios/cadastro/visitante', { body });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return { token: r.body.token, id: r.body.user.id, trigrama: body.trigrama, email: body.email, senha: body.senha, saram: body.saram };
}

// ---------- Café ----------

export async function criarAssinante(
  adminToken: string,
  nome_guerra: string,
  op: { tipo?: 'oficial' | 'graduado'; plano?: 'mensal' | 'anual'; valor?: number } = {},
): Promise<{ id: string; tipo: string; plano: string; primeira_cobranca: { id: string; referencia: string; periodo_fim: string | null } }> {
  const r = await api('/api/cafe/admin/assinantes', {
    token: adminToken,
    body: { nome_guerra, tipo: op.tipo, plano: op.plano ?? 'mensal', valor: op.valor ?? 25 },
  });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return r.body;
}

// ---------- Cantina / Loja ----------

/** Primeiro produto do seed do schema.sql (cantina). */
export async function produtoCantina(): Promise<{ id: string; preco: number; nome: string }> {
  const r = await api('/api/produtos');
  expect(r.status).toBe(200);
  expect(r.body.length).toBeGreaterThan(0);
  return r.body[0];
}

export async function pedidoCantina(token: string, metodo: 'pix' | 'fiado' | 'dinheiro' = 'fiado', extra: Record<string, unknown> = {}) {
  const p = await produtoCantina();
  return api('/api/pedidos', { token, body: { itens: [{ produto_id: p.id, quantidade: 1 }], metodo, ...extra } });
}

export async function criarProdutoLoja(adminToken: string, op: { preco?: number; preco_custo?: number | null } = {}) {
  const r = await api('/api/loja/admin/produtos', {
    token: adminToken,
    body: { nome: 'Camiseta do Esquadrão', descricao: 'teste', preco: op.preco ?? 90, preco_custo: op.preco_custo ?? 40 },
  });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return r.body as { id: string; preco: number };
}

// ---------- Comprovantes ----------

/** Usuário envia comprovante (multipart) de um item dele. */
export async function enviarComprovante(token: string, origem: string, referencia_id: string) {
  const form = new FormData();
  form.append('origem', origem);
  form.append('referencia_id', referencia_id);
  form.append('file', new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])], 'comprovante.jpg', { type: 'image/jpeg' }));
  return api('/api/comprovantes', { token, form, method: 'POST' });
}

// ---------- Datas ----------

/** Mês atual no horário de Brasília (mesma regra do backend). */
export function mesBrasilia(agora = new Date()): string {
  const d = new Date(agora.getTime() - 3 * 3600 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function somarMesesYM(ym: string, n: number): string {
  const [a, m] = ym.split('-').map(Number);
  const t = a * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
}
