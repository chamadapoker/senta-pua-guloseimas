-- Despesas da caixinha do café (saída de caixa)
CREATE TABLE IF NOT EXISTS cafe_despesas (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tipo        TEXT NOT NULL CHECK (tipo IN ('oficial', 'graduado')),
  descricao   TEXT NOT NULL,
  categoria   TEXT NOT NULL DEFAULT 'geral',
  valor       REAL NOT NULL,
  data        TEXT NOT NULL DEFAULT (date('now')),
  nota_fiscal TEXT DEFAULT NULL,
  observacao  TEXT DEFAULT '',
  created_by  TEXT DEFAULT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cafe_despesas_tipo_data ON cafe_despesas(tipo, data);
