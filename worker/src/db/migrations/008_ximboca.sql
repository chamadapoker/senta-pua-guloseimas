CREATE TABLE IF NOT EXISTS ximboca_eventos (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  nome            TEXT NOT NULL,
  data            TEXT NOT NULL,
  valor_por_pessoa REAL NOT NULL DEFAULT 0,
  descricao       TEXT DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'fechado')),
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ximboca_participantes (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  evento_id   TEXT NOT NULL REFERENCES ximboca_eventos(id) ON DELETE CASCADE,
  nome        TEXT NOT NULL,
  whatsapp    TEXT DEFAULT NULL,
  status      TEXT NOT NULL DEFAULT 'confirmado' CHECK (status IN ('confirmado', 'pago')),
  paid_at     TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ximboca_despesas (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  evento_id   TEXT NOT NULL REFERENCES ximboca_eventos(id) ON DELETE CASCADE,
  descricao   TEXT NOT NULL,
  valor       REAL NOT NULL,
  categoria   TEXT NOT NULL DEFAULT 'geral',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ximboca_part_evento ON ximboca_participantes(evento_id);
CREATE INDEX IF NOT EXISTS idx_ximboca_desp_evento ON ximboca_despesas(evento_id);
