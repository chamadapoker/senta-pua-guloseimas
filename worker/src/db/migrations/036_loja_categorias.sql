-- 036_loja_categorias.sql
-- Categorias para separar os produtos da loja (ex.: Vestuário, Canecas, Patches).
-- Só adiciona: nenhum dado existente é alterado. Produto sem categoria = categoria_id NULL.

CREATE TABLE IF NOT EXISTS loja_categorias (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  nome        TEXT NOT NULL UNIQUE COLLATE NOCASE,
  ordem       INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

ALTER TABLE loja_produtos ADD COLUMN categoria_id TEXT DEFAULT NULL REFERENCES loja_categorias(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_loja_produtos_categoria ON loja_produtos(categoria_id);
