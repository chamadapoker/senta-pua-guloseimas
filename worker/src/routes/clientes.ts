import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import type { AppType } from '../index';

const clientes = new Hono<AppType>();

// Público: autocomplete nome de guerra
clientes.get('/buscar', async (c) => {
  const q = c.req.query('q') || '';
  if (q.length < 2) return c.json([]);

  const { results } = await c.env.DB.prepare(
    "SELECT id, nome_guerra FROM clientes WHERE nome_guerra LIKE ? AND ativo = 1 LIMIT 10"
  ).bind(`%${q}%`).all();

  return c.json(results);
});

// Admin: lista clientes com saldo devedor
clientes.get('/', authMiddleware, async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT
      cl.id, cl.nome_guerra, cl.ativo, cl.created_at,
      COALESCE(SUM(p.total), 0) as total_comprado,
      COALESCE(SUM(CASE WHEN p.status = 'pago' THEN p.total ELSE 0 END), 0) as total_pago,
      COALESCE(SUM(CASE WHEN p.status IN ('pendente', 'fiado') THEN p.total ELSE 0 END), 0) as saldo_devedor,
      MAX(p.created_at) as ultima_compra
    FROM clientes cl
    LEFT JOIN pedidos p ON p.cliente_id = cl.id
    GROUP BY cl.id
    ORDER BY cl.nome_guerra ASC
  `).all();

  return c.json(results);
});

// Admin: extrato do cliente
clientes.get('/:id/extrato', authMiddleware, async (c) => {
  const id = c.req.param('id');

  const cliente = await c.env.DB.prepare(
    'SELECT * FROM clientes WHERE id = ?'
  ).bind(id).first();

  if (!cliente) return c.json({ error: 'Cliente não encontrado' }, 404);

  const { results: pedidos } = await c.env.DB.prepare(`
    SELECT p.*, GROUP_CONCAT(ip.nome_produto || ' x' || ip.quantidade, ', ') as itens_resumo
    FROM pedidos p
    LEFT JOIN itens_pedido ip ON ip.pedido_id = p.id
    WHERE p.cliente_id = ?
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `).bind(id).all();

  return c.json({ cliente, pedidos });
});

export default clientes;
