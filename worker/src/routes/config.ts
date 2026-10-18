import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { audit } from '../lib/audit';
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

// Valores padrão do café por sala e plano (usados ao criar assinante sem valor)
const CHAVES_VALOR_CAFE = [
  'cafe_valor_oficial_mensal', 'cafe_valor_oficial_anual',
  'cafe_valor_graduado_mensal', 'cafe_valor_graduado_anual',
];

// Aceita "25,50" ou "25.50"; vazio/inválido/negativo vira "" (sem padrão)
function normalizarValor(valor: unknown): string {
  const n = parseFloat(String(valor ?? '').replace(',', '.'));
  return n > 0 ? String(Math.round(n * 100) / 100) : '';
}

// Admin: atualizar configuração
config.put('/', authMiddleware, async (c) => {
  const body = await c.req.json<Record<string, string>>();

  // Valores atuais, para registrar só o que mudou (antes/depois)
  const { results: atuais } = await c.env.DB.prepare(
    'SELECT chave, valor FROM configuracoes'
  ).all<{ chave: string; valor: string }>();
  const mapaAtual = new Map(atuais.map(r => [r.chave, r.valor]));

  const antes: Record<string, string | null> = {};
  const depois: Record<string, string> = {};

  const batch = Object.entries(body).map(([chave, valor]) => {
    let v = valor;
    if (/^pix_.*_nome$/.test(chave)) v = sanitizarNomePix(valor);
    else if (/^pix_.*_cidade$/.test(chave)) v = sanitizarCidadePix(valor);
    else if (CHAVES_VALOR_CAFE.includes(chave)) v = normalizarValor(valor);
    const anterior = mapaAtual.get(chave) ?? null;
    if (anterior !== v) { antes[chave] = anterior; depois[chave] = v; }
    return c.env.DB.prepare(
      'INSERT INTO configuracoes (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = ?'
    ).bind(chave, v, v);
  });

  if (batch.length) await c.env.DB.batch(batch);
  const alteradas = Object.keys(depois);
  if (alteradas.length) {
    await audit(c, 'alterar_config', 'configuracoes', alteradas.join(','), antes, depois);
  }
  return c.json({ ok: true });
});

export default config;
