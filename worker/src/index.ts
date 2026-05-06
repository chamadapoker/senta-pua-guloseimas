import { Hono } from 'hono';
import { cors } from 'hono/cors';
import auth from './routes/auth';
import produtos from './routes/produtos';
import clientes from './routes/clientes';
import pedidos from './routes/pedidos';
import pix from './routes/pix';
import dashboard from './routes/dashboard';
import images from './routes/images';
import config from './routes/config';
import loja from './routes/loja';
import cafe from './routes/cafe';
import ximboca from './routes/ximboca';
import usuarios from './routes/usuarios';
import admins from './routes/admins';
import comprovantes from './routes/comprovantes';
import auditoria from './routes/auditoria';

export type Env = {
  DB: D1Database;
  IMAGES: R2Bucket;
  JWT_SECRET: string;
  ADMIN_EMAIL: string;
  ADMIN_SENHA: string;
  FRONTEND_URL: string;
  AMBIENTE: string;
};

export type AppType = { Bindings: Env; Variables: { adminEmail: string; adminRole: string; adminId: string; userId: number; userEmail: string; userTrigrama: string } };

const app = new Hono<AppType>();

app.use('*', async (c, next) => {
  const corsMiddleware = cors({
    origin: [c.env.FRONTEND_URL, 'https://app-senta-pua.pages.dev', 'http://localhost:5173'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  });
  return corsMiddleware(c, next);
});

app.route('/api/auth', auth);
app.route('/api/produtos', produtos);
app.route('/api/clientes', clientes);
app.route('/api/pedidos', pedidos);
app.route('/api/pix', pix);
app.route('/api/admin', dashboard);
app.route('/api/images', images);
app.route('/api/config', config);
app.route('/api/loja', loja);
app.route('/api/cafe', cafe);
app.route('/api/ximboca', ximboca);
app.route('/api/usuarios', usuarios);
app.route('/api/admins', admins);
app.route('/api/comprovantes', comprovantes);
app.route('/api/auditoria', auditoria);

app.get('/api/health', (c) => c.json({ status: 'ok' }));

// Cron handler: gera mensalidades e anuais automaticamente
async function gerarCobrancasAutomaticas(env: Env) {
  const now = new Date();
  const ano = String(now.getUTCFullYear());
  const mes = `${ano}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

  const { results: mensais } = await env.DB.prepare(
    "SELECT id, valor FROM cafe_assinantes WHERE ativo = 1 AND plano = 'mensal'"
  ).all<{ id: string; valor: number }>();
  const { results: anuais } = await env.DB.prepare(
    "SELECT id, valor FROM cafe_assinantes WHERE ativo = 1 AND plano = 'anual'"
  ).all<{ id: string; valor: number }>();

  const { results: existMes } = await env.DB.prepare(
    'SELECT assinante_id FROM cafe_pagamentos WHERE referencia = ?'
  ).bind(mes).all<{ assinante_id: string }>();
  const { results: existAno } = await env.DB.prepare(
    'SELECT assinante_id FROM cafe_pagamentos WHERE referencia = ?'
  ).bind(ano).all<{ assinante_id: string }>();

  const jaMes = new Set(existMes.map(e => e.assinante_id));
  const jaAno = new Set(existAno.map(e => e.assinante_id));

  const batch: D1PreparedStatement[] = [];
  for (const a of mensais) {
    if (!jaMes.has(a.id)) {
      batch.push(env.DB.prepare('INSERT INTO cafe_pagamentos (assinante_id, referencia, valor) VALUES (?, ?, ?)').bind(a.id, mes, a.valor));
    }
  }
  // Só gera anual em janeiro (mes 01)
  if (now.getUTCMonth() === 0) {
    for (const a of anuais) {
      if (!jaAno.has(a.id)) {
        batch.push(env.DB.prepare('INSERT INTO cafe_pagamentos (assinante_id, referencia, valor) VALUES (?, ?, ?)').bind(a.id, ano, a.valor));
      }
    }
  }
  if (batch.length) await env.DB.batch(batch);

  await env.DB.prepare(
    `INSERT INTO audit_log (admin_email, acao, entidade, entidade_id, dados_depois) VALUES ('cron', 'gerar_cobrancas_auto', 'cafe_pagamentos', NULL, ?)`
  ).bind(JSON.stringify({ mes, ano, mensais_criados: batch.length, data: now.toISOString() })).run();

  return { mes, ano, total_criado: batch.length };
}

async function gerarRelatorioCobrancaRP(env: Env) {
  const now = new Date();
  // Só executa no dia 01
  if (now.getUTCDate() !== 1) return;

  const { results: devedores } = await env.DB.prepare(`
    SELECT cl.nome_guerra, cl.whatsapp,
           (SELECT COALESCE(SUM(total), 0) FROM pedidos WHERE cliente_id = cl.id AND status IN ('pendente', 'fiado')) +
           (SELECT COALESCE(SUM(total), 0) FROM loja_pedidos WHERE cliente_id = cl.id AND status IN ('pendente', 'fiado')) +
           (SELECT COALESCE(SUM(valor), 0) FROM cafe_pagamentos cp JOIN cafe_assinantes ca ON ca.id = cp.assinante_id WHERE ca.cliente_id = cl.id AND cp.status = 'pendente') as total_divida
    FROM clientes cl
    WHERE total_divida > 0
    ORDER BY total_divida DESC
  `).all<{ nome_guerra: string; whatsapp: string | null; total_divida: number }>();

  if (devedores.length === 0) return;

  const resumo = {
    mes_referencia: now.getUTCMonth() === 0 ? 12 : now.getUTCMonth(),
    ano_referencia: now.getUTCMonth() === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear(),
    total_militares: devedores.length,
    valor_total: devedores.reduce((s, d) => s + d.total_divida, 0),
    top_devedores: devedores.slice(0, 5)
  };

  await env.DB.prepare(
    `INSERT INTO audit_log (admin_email, acao, entidade, dados_depois) VALUES ('cron', 'fechamento_mensal_rp', 'faturamento', ?)`
  ).bind(JSON.stringify(resumo)).run();
}

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(Promise.all([
      gerarCobrancasAutomaticas(env),
      gerarRelatorioCobrancaRP(env)
    ]));
  },
};
