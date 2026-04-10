CREATE TABLE IF NOT EXISTS loja_produto_imagens (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  produto_id  TEXT NOT NULL REFERENCES loja_produtos(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  ordem       INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_loja_imagens_produto ON loja_produto_imagens(produto_id);
