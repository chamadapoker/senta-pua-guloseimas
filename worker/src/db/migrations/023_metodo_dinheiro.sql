-- Aceita metodo_pagamento = 'dinheiro' em pedidos da cantina e loja
-- SQLite nao permite ALTER CHECK, entao recriamos tabela

-- ===== PEDIDOS (cantina) =====
CREATE TABLE pedidos_novo (
  id                 TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  cliente_id         TEXT NOT NULL REFERENCES clientes(id),
  total              REAL NOT NULL,
  status             TEXT NOT NULL DEFAULT 'pendente'
                       CHECK (status IN ('pendente','pago','fiado')),
  metodo_pagamento   TEXT NOT NULL DEFAULT 'pix'
                       CHECK (metodo_pagamento IN ('pix','fiado','dinheiro')),
  pix_payment_id     TEXT,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  paid_at            TEXT
);
INSERT INTO pedidos_novo (id, cliente_id, total, status, metodo_pagamento, pix_payment_id, created_at, paid_at)
  SELECT id, cliente_id, total, status, metodo_pagamento, pix_payment_id, created_at, paid_at FROM pedidos;
DROP TABLE pedidos;
ALTER TABLE pedidos_novo RENAME TO pedidos;
CREATE INDEX IF NOT EXISTS idx_pedidos_cliente ON pedidos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_status ON pedidos(status);

-- ===== LOJA_PEDIDOS =====
CREATE TABLE loja_pedidos_novo (
  id                 TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  cliente_id         TEXT NOT NULL REFERENCES clientes(id),
  total              REAL NOT NULL,
  status             TEXT NOT NULL DEFAULT 'pendente'
                       CHECK (status IN ('pendente','pago','fiado')),
  metodo_pagamento   TEXT NOT NULL DEFAULT 'pix'
                       CHECK (metodo_pagamento IN ('pix','fiado','dinheiro')),
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  paid_at            TEXT,
  parcelas           INTEGER NOT NULL DEFAULT 1
);
INSERT INTO loja_pedidos_novo (id, cliente_id, total, status, metodo_pagamento, created_at, paid_at, parcelas)
  SELECT id, cliente_id, total, status, metodo_pagamento, created_at, paid_at, parcelas FROM loja_pedidos;
DROP TABLE loja_pedidos;
ALTER TABLE loja_pedidos_novo RENAME TO loja_pedidos;
CREATE INDEX IF NOT EXISTS idx_loja_pedidos_cliente ON loja_pedidos(cliente_id);
