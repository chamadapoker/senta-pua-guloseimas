import type { Context } from 'hono';
import type { AppType } from '../index';
import { checkRateLimit, recordAttempt } from './rateLimit';

/** IP do cliente para auditoria: só o CF-Connecting-IP (setado pela borda da Cloudflare). */
export function ipDoCliente(c: Context<AppType>): string | null {
  // X-Forwarded-For não é usado: o cliente pode forjá-lo.
  return c.req.header('CF-Connecting-IP') || null;
}

export async function audit(
  c: Context<AppType>,
  acao: string,
  entidade: string,
  entidade_id: string | null | undefined,
  dados_antes: unknown = null,
  dados_depois: unknown = null,
  /** Quem fez, quando ainda não há sessão (ex.: login). Padrão: admin/usuário da requisição. */
  ator?: string
) {
  // Ações de usuário (sem admin) ficam identificadas como "usuario:<email>"
  const userEmail = c.get('userEmail');
  const email = ator || c.get('adminEmail') || (userEmail ? `usuario:${userEmail}` : 'system');
  const ip = ipDoCliente(c);
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

// Negação de escopo: no máximo 1 registro por admin+método+caminho a cada 10 minutos
// (a tabela rate_limit_attempts serve de marcador; a limpeza diária apaga os marcadores velhos).
const JANELA_NEGACAO_MIN = 10;

export async function auditarNegacaoEscopo(c: Context<AppType>): Promise<void> {
  try {
    const adminId = c.get('adminId');
    const metodo = c.req.method;
    const caminho = c.req.path.slice(0, 300);
    const chave = `${adminId}:${metodo} ${caminho}`;
    const rl = await checkRateLimit(c, 'audit_escopo_negado', chave, 1, JANELA_NEGACAO_MIN);
    if (!rl.ok) return;
    await recordAttempt(c, 'audit_escopo_negado', chave);
    await audit(c, 'acesso_negado_escopo', 'admins', adminId, null, {
      escopo: c.get('adminEscopo'), metodo, caminho,
    });
  } catch (e) {
    console.error('audit escopo negado failed', e);
  }
}
