import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import type { AppType } from '../index';

const auditoria = new Hono<AppType>();

auditoria.use('*', authMiddleware);

auditoria.get('/', async (c) => {
  const entidade = c.req.query('entidade');
  const admin = c.req.query('admin');
  const acao = c.req.query('acao');
  const limit = Math.min(parseInt(c.req.query('limit') || '100', 10), 500);

  let sql = 'SELECT * FROM audit_log WHERE 1=1';
  const params: unknown[] = [];
  if (entidade) { sql += ' AND entidade = ?'; params.push(entidade); }
  if (admin)    { sql += ' AND admin_email = ?'; params.push(admin); }
  if (acao)     { sql += ' AND acao = ?'; params.push(acao); }
  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  const { results } = await c.env.DB.prepare(sql).bind(...params).all();
  return c.json(results);
});

export default auditoria;
