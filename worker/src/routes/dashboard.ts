import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import type { AppType } from '../index';

const dashboard = new Hono<AppType>();

dashboard.get('/stats', authMiddleware, async (c) => {
  const now = new Date();
  const mesAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const hoje = now.toISOString().split('T')[0];

  const [vendidoMes, recebidoMes, pendente, vendasHoje, devedores, ultimos7dias] = await Promise.all([
    c.env.DB.prepare(
      "SELECT COALESCE(SUM(total), 0) as valor FROM pedidos WHERE created_at LIKE ? || '%'"
    ).bind(mesAtual).first<{ valor: number }>(),

    c.env.DB.prepare(
      "SELECT COALESCE(SUM(total), 0) as valor FROM pedidos WHERE status = 'pago' AND created_at LIKE ? || '%'"
    ).bind(mesAtual).first<{ valor: number }>(),

    c.env.DB.prepare(
      "SELECT COALESCE(SUM(total), 0) as valor FROM pedidos WHERE status IN ('pendente', 'fiado')"
    ).first<{ valor: number }>(),

    c.env.DB.prepare(
      "SELECT COUNT(*) as valor FROM pedidos WHERE DATE(created_at) = ?"
    ).bind(hoje).first<{ valor: number }>(),

    c.env.DB.prepare(`
      SELECT cl.id as cliente_id, cl.nome_guerra,
        SUM(p.total) as total_devido
      FROM pedidos p
      JOIN clientes cl ON cl.id = p.cliente_id
      WHERE p.status IN ('pendente', 'fiado')
      GROUP BY cl.id
      ORDER BY total_devido DESC
    `).all(),

    c.env.DB.prepare(`
      SELECT DATE(created_at) as data, COALESCE(SUM(total), 0) as total
      FROM pedidos
      WHERE created_at >= datetime('now', '-7 days')
      GROUP BY DATE(created_at)
      ORDER BY data ASC
    `).all(),
  ]);

  return c.json({
    vendido_mes: vendidoMes?.valor ?? 0,
    recebido_mes: recebidoMes?.valor ?? 0,
    pendente_total: pendente?.valor ?? 0,
    vendas_hoje: vendasHoje?.valor ?? 0,
    devedores: devedores.results,
    ultimos_7_dias: ultimos7dias.results,
  });
});

export default dashboard;
