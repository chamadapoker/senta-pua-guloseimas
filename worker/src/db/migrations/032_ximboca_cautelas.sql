-- Cautela de material do evento: itens emprestados (rancho etc.) com baixa na devolucao.
CREATE TABLE IF NOT EXISTS ximboca_cautelas (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  evento_id     TEXT NOT NULL REFERENCES ximboca_eventos(id) ON DELETE CASCADE,
  item          TEXT NOT NULL,
  quantidade    REAL NOT NULL DEFAULT 0,
  unidade       TEXT NOT NULL DEFAULT 'un',
  origem        TEXT DEFAULT NULL,        -- de onde veio / dono (ex: Rancho)
  responsavel   TEXT DEFAULT NULL,        -- quem ficou responsavel pela cautela
  qtd_devolvida REAL NOT NULL DEFAULT 0,
  observacao    TEXT DEFAULT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ximboca_cautelas_evento ON ximboca_cautelas(evento_id);
