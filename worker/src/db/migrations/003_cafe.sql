CREATE TABLE IF NOT EXISTS cafe_assinantes (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  cliente_id  TEXT NOT NULL REFERENCES clientes(id),
  tipo        TEXT NOT NULL CHECK (tipo IN ('oficial', 'graduado')),
  plano       TEXT NOT NULL DEFAULT 'mensal' CHECK (plano IN ('mensal', 'anual')),
  valor       REAL NOT NULL,
  ativo       INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cafe_pagamentos (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  assinante_id    TEXT NOT NULL REFERENCES cafe_assinantes(id) ON DELETE CASCADE,
  referencia      TEXT NOT NULL,
  valor           REAL NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago')),
  metodo          TEXT DEFAULT 'pix' CHECK (metodo IN ('pix', 'dinheiro', 'transferencia')),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  paid_at         TEXT
);

CREATE TABLE IF NOT EXISTS cafe_insumos (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  nome        TEXT NOT NULL,
  unidade     TEXT NOT NULL DEFAULT 'un',
  estoque     REAL NOT NULL DEFAULT 0,
  estoque_min REAL NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cafe_assinantes_cliente ON cafe_assinantes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cafe_pagamentos_assinante ON cafe_pagamentos(assinante_id);
