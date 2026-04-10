import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import type { AppType } from '../index';

const config = new Hono<AppType>();

// Público: buscar configurações (nomes das salas)
config.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT chave, valor FROM configuracoes'
  ).all<{ chave: string; valor: string }>();

  const obj: Record<string, string> = {};
  for (const r of results) obj[r.chave] = r.valor;
  return c.json(obj);
});

// Admin: atualizar configuração
config.put('/', authMiddleware, async (c) => {
  const body = await c.req.json<Record<string, string>>();

  const batch = Object.entries(body).map(([chave, valor]) =>
    c.env.DB.prepare(
      'INSERT INTO configuracoes (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = ?'
    ).bind(chave, valor, valor)
  );

  if (batch.length) await c.env.DB.batch(batch);
  return c.json({ ok: true });
});

export default config;
