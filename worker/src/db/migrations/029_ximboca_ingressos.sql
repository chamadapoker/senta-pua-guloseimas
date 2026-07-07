-- Tipos de ingresso por evento (Militar, Convidado, Crianca...)
CREATE TABLE IF NOT EXISTS ximboca_ingresso_tipos (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  evento_id  TEXT NOT NULL REFERENCES ximboca_eventos(id) ON DELETE CASCADE,
  nome       TEXT NOT NULL,
  valor      REAL NOT NULL,
  ordem      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_ximboca_ing_tipos_evento ON ximboca_ingresso_tipos(evento_id);

-- Participante: tipo comprado, numero visivel do ingresso e dados de check-in
ALTER TABLE ximboca_participantes ADD COLUMN tipo_ingresso_id TEXT;
ALTER TABLE ximboca_participantes ADD COLUMN numero_ingresso  INTEGER;
ALTER TABLE ximboca_participantes ADD COLUMN checkin_at       TEXT;
ALTER TABLE ximboca_participantes ADD COLUMN checkin_por      TEXT;

-- Evento: capa (R2)
ALTER TABLE ximboca_eventos ADD COLUMN imagem_url TEXT;

-- Papel de recepcionista (porteiro) em usuarios
ALTER TABLE usuarios ADD COLUMN is_recepcionista INTEGER NOT NULL DEFAULT 0;
