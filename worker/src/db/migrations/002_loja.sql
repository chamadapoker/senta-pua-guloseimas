CREATE TABLE IF NOT EXISTS loja_produtos (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  nome        TEXT NOT NULL,
  descricao   TEXT DEFAULT '',
  preco       REAL NOT NULL,
  imagem_url  TEXT DEFAULT NULL,
  disponivel  INTEGER NOT NULL DEFAULT 1,
  ordem       INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS loja_variacoes (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  produto_id  TEXT NOT NULL REFERENCES loja_produtos(id) ON DELETE CASCADE,
  nome        TEXT NOT NULL,
  estoque     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS loja_pedidos (
  id                 TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  cliente_id         TEXT NOT NULL REFERENCES clientes(id),
  total              REAL NOT NULL,
  status             TEXT NOT NULL DEFAULT 'pendente'
                       CHECK (status IN ('pendente','pago','fiado')),
  metodo_pagamento   TEXT NOT NULL DEFAULT 'pix'
                       CHECK (metodo_pagamento IN ('pix','fiado')),
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  paid_at            TEXT
);

CREATE TABLE IF NOT EXISTS loja_itens_pedido (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  pedido_id       TEXT NOT NULL REFERENCES loja_pedidos(id) ON DELETE CASCADE,
  produto_id      TEXT NOT NULL REFERENCES loja_produtos(id),
  variacao_id     TEXT REFERENCES loja_variacoes(id),
  nome_produto    TEXT NOT NULL,
  nome_variacao   TEXT DEFAULT NULL,
  preco_unitario  REAL NOT NULL,
  quantidade      INTEGER NOT NULL,
  subtotal        REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_loja_variacoes_produto ON loja_variacoes(produto_id);
CREATE INDEX IF NOT EXISTS idx_loja_pedidos_cliente ON loja_pedidos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_loja_itens_pedido ON loja_itens_pedido(pedido_id);
