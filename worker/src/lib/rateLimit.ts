import type { Context } from 'hono';
import type { AppType } from '../index';

// Sliding window: bloqueia se tiverem havido `max` tentativas nos ultimos `windowMin` minutos
export async function checkRateLimit(
  c: Context<AppType>,
  acao: string,
  key: string,
  max = 5,
  windowMin = 15
): Promise<{ ok: boolean; remaining: number; retry_after_min?: number }> {
  const row = await c.env.DB.prepare(
    `SELECT COUNT(*) as n FROM rate_limit_attempts
     WHERE key = ? AND acao = ? AND created_at >= datetime('now', '-' || ? || ' minutes')`
  ).bind(key, acao, windowMin).first<{ n: number }>();

  const count = row?.n || 0;
  if (count >= max) {
    return { ok: false, remaining: 0, retry_after_min: windowMin };
  }
  return { ok: true, remaining: max - count };
}

export async function recordAttempt(c: Context<AppType>, acao: string, key: string) {
  await c.env.DB.prepare(
    'INSERT INTO rate_limit_attempts (key, acao) VALUES (?, ?)'
  ).bind(key, acao).run();

  // Cleanup oportunista: apaga attempts > 24h
  if (Math.random() < 0.1) {
    await c.env.DB.prepare(
      "DELETE FROM rate_limit_attempts WHERE created_at < datetime('now', '-1 day')"
    ).run();
  }
}

export async function clearAttempts(c: Context<AppType>, acao: string, key: string) {
  await c.env.DB.prepare(
    'DELETE FROM rate_limit_attempts WHERE key = ? AND acao = ?'
  ).bind(key, acao).run();
}

export function clientKey(c: Context<AppType>): string {
  return c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
}
