-- Checklist de organizacao do evento: tarefas com responsavel e status.
CREATE TABLE IF NOT EXISTS ximboca_tarefas (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  evento_id   TEXT NOT NULL REFERENCES ximboca_eventos(id) ON DELETE CASCADE,
  titulo      TEXT NOT NULL,
  responsavel TEXT DEFAULT NULL,   -- nome/trigrama de quem ficou responsavel
  feito       INTEGER NOT NULL DEFAULT 0,
  ordem       INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ximboca_tarefas_evento ON ximboca_tarefas(evento_id);
