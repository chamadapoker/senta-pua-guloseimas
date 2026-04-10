CREATE TABLE IF NOT EXISTS ximboca_estoque (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  nome        TEXT NOT NULL,
  quantidade  REAL NOT NULL DEFAULT 0,
  unidade     TEXT NOT NULL DEFAULT 'un',
  origem_evento TEXT DEFAULT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

ALTER TABLE ximboca_despesas ADD COLUMN quantidade REAL DEFAULT NULL;
ALTER TABLE ximboca_despesas ADD COLUMN unidade TEXT DEFAULT NULL;

ALTER TABLE ximboca_participantes ADD COLUMN valor_individual REAL DEFAULT NULL;
ALTER TABLE ximboca_participantes ADD COLUMN categoria_consumo TEXT DEFAULT 'padrao';
