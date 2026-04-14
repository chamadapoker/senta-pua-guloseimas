-- Rate limiting basico para login (sliding window no D1)
CREATE TABLE IF NOT EXISTS rate_limit_attempts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  key         TEXT NOT NULL,
  acao        TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_key ON rate_limit_attempts(key, acao, created_at DESC);
