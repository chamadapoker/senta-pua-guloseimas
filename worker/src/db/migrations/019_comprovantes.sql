-- Comprovantes unificados para cantina, loja, cafe, ximboca (+ parcelas da loja)
CREATE TABLE IF NOT EXISTS comprovantes (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  origem          TEXT NOT NULL CHECK (origem IN ('cantina', 'loja', 'loja_parcela', 'cafe', 'ximboca')),
  referencia_id   TEXT NOT NULL,
  cliente_id      TEXT REFERENCES clientes(id),
  usuario_id      TEXT,
  trigrama        TEXT,
  valor           REAL,
  imagem_url      TEXT NOT NULL,
  imagem_key      TEXT NOT NULL,
  observacao      TEXT DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'aguardando'
                    CHECK (status IN ('aguardando', 'aprovado', 'rejeitado')),
  motivo_rejeicao TEXT DEFAULT NULL,
  reviewed_by     TEXT DEFAULT NULL,
  reviewed_at     TEXT DEFAULT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_comprov_status ON comprovantes(status);
CREATE INDEX IF NOT EXISTS idx_comprov_origem_ref ON comprovantes(origem, referencia_id);
CREATE INDEX IF NOT EXISTS idx_comprov_cliente ON comprovantes(cliente_id);
