import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import type { AppType } from '../index';

const auditoria = new Hono<AppType>();

auditoria.use('*', authMiddleware);

auditoria.get('/', async (c) => {
  const entidade = c.req.query('entidade');
  const admin = c.req.query('admin');
  const acao = c.req.query('acao');
  const q = c.req.query('q');
  const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 200);
  const offset = Math.max(parseInt(c.req.query('offset') || '0', 10), 0);

  const conds: string[] = ['1=1'];
  const params: unknown[] = [];
  if (entidade) { conds.push('entidade = ?'); params.push(entidade); }
  if (admin)    { conds.push('admin_email = ?'); params.push(admin); }
  if (acao)     { conds.push('acao = ?'); params.push(acao); }
  if (q)        { conds.push('(admin_email LIKE ? OR acao LIKE ? OR entidade_id LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }

  const where = conds.join(' AND ');
  const totalRow = await c.env.DB.prepare(`SELECT COUNT(*) as total FROM audit_log WHERE ${where}`).bind(...params).first<{ total: number }>();

  const { results } = await c.env.DB.prepare(
    `SELECT * FROM audit_log WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).bind(...params, limit, offset).all();

  return c.json({ items: results, total: totalRow?.total || 0, limit, offset });
});

export default auditoria;
