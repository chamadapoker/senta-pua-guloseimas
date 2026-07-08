-- Inventario interno da RP: itens que a RP compra e NAO vende (brindes, quadros, facas...).
-- Fornecedores separados (reuso em varios itens).
CREATE TABLE IF NOT EXISTS fornecedores (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  nome       TEXT NOT NULL,
  contato    TEXT DEFAULT NULL,   -- telefone / WhatsApp
  endereco   TEXT DEFAULT NULL,
  observacao TEXT DEFAULT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS inventario (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  nome          TEXT NOT NULL,
  finalidade    TEXT DEFAULT NULL,   -- presente | uso_interno | consumo | outro
  quantidade    REAL NOT NULL DEFAULT 0,
  unidade       TEXT NOT NULL DEFAULT 'un',
  valor_compra  REAL DEFAULT NULL,   -- valor de compra (total)
  fornecedor_id TEXT REFERENCES fornecedores(id) ON DELETE SET NULL,
  observacao    TEXT DEFAULT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_inventario_fornecedor ON inventario(fornecedor_id);
