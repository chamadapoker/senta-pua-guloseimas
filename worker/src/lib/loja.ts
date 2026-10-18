// Pagamento de pedidos da loja (pedido inteiro ou parcela) mantendo pedido e parcelas consistentes.
// Tudo roda num único DB.batch (transação no D1).

export type LojaPedidoPago = { id: string; cliente_id: string; total: number; status: string; parcelas: number };
export type LojaParcelaPaga = { id: string; pedido_id: string; numero: number; total_parcelas: number; valor: number; status: string };

/** Paga o pedido inteiro e quita todas as parcelas ainda pendentes. */
export async function pagarPedidoLoja(db: D1Database, pedidoId: string) {
  const [ped, parc] = await db.batch([
    db.prepare(
      "UPDATE loja_pedidos SET status = 'pago', paid_at = datetime('now') WHERE id = ? AND status != 'pago' RETURNING *"
    ).bind(pedidoId),
    // Só quita parcelas se o pedido estiver pago (inclusive se já estava, corrigindo inconsistência antiga)
    db.prepare(
      `UPDATE loja_parcelas SET status = 'pago', paid_at = datetime('now')
       WHERE pedido_id = ? AND status != 'pago'
         AND EXISTS (SELECT 1 FROM loja_pedidos WHERE id = ? AND status = 'pago')`
    ).bind(pedidoId, pedidoId),
  ]);
  return {
    pedido: ((ped.results as LojaPedidoPago[])[0]) ?? null,
    parcelas_quitadas: parc.meta?.changes ?? 0,
  };
}

/** Paga uma parcela e, se era a última pendente, marca o pedido como pago. */
export async function pagarParcelaLoja(db: D1Database, parcelaId: string) {
  const [parc, ped] = await db.batch([
    db.prepare(
      "UPDATE loja_parcelas SET status = 'pago', paid_at = datetime('now') WHERE id = ? AND status != 'pago' RETURNING *"
    ).bind(parcelaId),
    db.prepare(
      `UPDATE loja_pedidos SET status = 'pago', paid_at = datetime('now')
       WHERE id = (SELECT pedido_id FROM loja_parcelas WHERE id = ?)
         AND status != 'pago'
         AND NOT EXISTS (
           SELECT 1 FROM loja_parcelas
           WHERE pedido_id = (SELECT pedido_id FROM loja_parcelas WHERE id = ?) AND status != 'pago'
         )`
    ).bind(parcelaId, parcelaId),
  ]);
  return {
    parcela: ((parc.results as LojaParcelaPaga[])[0]) ?? null,
    pedido_quitado: (ped.meta?.changes ?? 0) > 0,
  };
}
