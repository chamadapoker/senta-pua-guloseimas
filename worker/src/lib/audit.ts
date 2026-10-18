import type { Context } from 'hono';
import type { AppType } from '../index';

export async function audit(
  c: Context<AppType>,
  acao: string,
  entidade: string,
  entidade_id: string | null | undefined,
  dados_antes: unknown = null,
  dados_depois: unknown = null
) {
  // Ações de usuário (sem admin) ficam identificadas como "usuario:<email>"
  const userEmail = c.get('userEmail');
  const email = c.get('adminEmail') || (userEmail ? `usuario:${userEmail}` : 'system');
  const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || null;
  try {
    await c.env.DB.prepare(
      `INSERT INTO audit_log (admin_email, acao, entidade, entidade_id, dados_antes, dados_depois, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      email,
      acao,
      entidade,
      entidade_id ?? null,
      dados_antes ? JSON.stringify(dados_antes) : null,
      dados_depois ? JSON.stringify(dados_depois) : null,
      ip
    ).run();
  } catch (e) {
    console.error('audit log failed', e);
  }
}
