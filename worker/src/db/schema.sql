CREATE TABLE IF NOT EXISTS produtos (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  nome        TEXT NOT NULL,
  emoji       TEXT NOT NULL DEFAULT '🍬',
  preco       REAL NOT NULL,
  disponivel  INTEGER NOT NULL DEFAULT 1,
  ordem       INTEGER NOT NULL DEFAULT 0,
  imagem_url  TEXT DEFAULT NULL,
  categoria   TEXT NOT NULL DEFAULT 'geral'
                CHECK (categoria IN ('oficiais', 'graduados', 'geral')),
  estoque     INTEGER DEFAULT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS clientes (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  nome_guerra TEXT NOT NULL UNIQUE COLLATE NOCASE,
  whatsapp    TEXT DEFAULT NULL,
  visitante   INTEGER NOT NULL DEFAULT 0,
  esquadrao_origem TEXT DEFAULT NULL,
  ativo       INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pedidos (
  id                 TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  cliente_id         TEXT NOT NULL REFERENCES clientes(id),
  total              REAL NOT NULL,
  status             TEXT NOT NULL DEFAULT 'pendente'
                       CHECK (status IN ('pendente','pago','fiado')),
  metodo_pagamento   TEXT NOT NULL DEFAULT 'pix'
                       CHECK (metodo_pagamento IN ('pix','fiado')),
  pix_payment_id     TEXT,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  paid_at            TEXT
);

CREATE TABLE IF NOT EXISTS itens_pedido (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  pedido_id       TEXT NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  produto_id      TEXT REFERENCES produtos(id),
  nome_produto    TEXT NOT NULL,
  preco_unitario  REAL NOT NULL,
  quantidade      INTEGER NOT NULL,
  subtotal        REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS admin (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email         TEXT NOT NULL UNIQUE,
  senha_hash    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS configuracoes (
  chave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);

INSERT OR IGNORE INTO configuracoes (chave, valor) VALUES
  ('nome_sala_oficiais', 'Sala dos Oficiais'),
  ('nome_sala_graduados', 'Sala dos Graduados');

INSERT OR IGNORE INTO configuracoes (chave, valor) VALUES ('loja_max_parcelas', '1');

CREATE INDEX IF NOT EXISTS idx_pedidos_cliente ON pedidos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_status  ON pedidos(status);
CREATE INDEX IF NOT EXISTS idx_itens_pedido    ON itens_pedido(pedido_id);

INSERT OR IGNORE INTO produtos (nome, emoji, preco, ordem) VALUES
  ('Chocolate',     '🍫', 4.00,  1),
  ('Pastel',        '🥐', 6.50,  2),
  ('Refri Latinha', '🥤', 5.00,  3),
  ('Toddy',         '🥛', 3.50,  4),
  ('Rapadura',      '🍬', 2.00,  5),
  ('Sanduíche',     '🥪', 8.00,  6);
