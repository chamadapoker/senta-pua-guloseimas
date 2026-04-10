CREATE TABLE IF NOT EXISTS loja_parcelas (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  pedido_id   TEXT NOT NULL REFERENCES loja_pedidos(id) ON DELETE CASCADE,
  numero      INTEGER NOT NULL,
  total_parcelas INTEGER NOT NULL,
  valor       REAL NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  paid_at     TEXT
);

ALTER TABLE loja_pedidos ADD COLUMN parcelas INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_loja_parcelas_pedido ON loja_parcelas(pedido_id);
