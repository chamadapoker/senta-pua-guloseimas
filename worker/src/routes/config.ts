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

// Remove acentos/cedilha/caracteres invalidos pra PIX
function sanitizarNomePix(valor: string): string {
  return valor
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^A-Za-z0-9 ]/g, '')                    // só ASCII básico
    .toUpperCase()
    .slice(0, 25)
    .trim();
}

function sanitizarCidadePix(valor: string): string {
  return valor
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z ]/g, '')
    .toUpperCase()
    .slice(0, 15)
    .trim();
}

// Admin: atualizar configuração
config.put('/', authMiddleware, async (c) => {
  const body = await c.req.json<Record<string, string>>();

  const batch = Object.entries(body).map(([chave, valor]) => {
    let v = valor;
    if (/^pix_.*_nome$/.test(chave)) v = sanitizarNomePix(valor);
    else if (/^pix_.*_cidade$/.test(chave)) v = sanitizarCidadePix(valor);
    return c.env.DB.prepare(
      'INSERT INTO configuracoes (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = ?'
    ).bind(chave, v, v);
  });

  if (batch.length) await c.env.DB.batch(batch);
  return c.json({ ok: true });
});

export default config;
