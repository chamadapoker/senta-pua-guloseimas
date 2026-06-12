-- 027_notificacoes.sql
-- Versiona a tabela `notificacoes`, que até então só era criada de forma
-- lazy pelo código (notificacoes.ts) e não tinha migration. IF NOT EXISTS
-- torna a aplicação segura tanto em produção (no-op) quanto em DB novo.

CREATE TABLE IF NOT EXISTS notificacoes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  trigrama    TEXT,
  titulo      TEXT,
  mensagem    TEXT,
  lida        INTEGER DEFAULT 0,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
