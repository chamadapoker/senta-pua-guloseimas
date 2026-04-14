CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  trigrama TEXT NOT NULL UNIQUE,
  saram TEXT NOT NULL UNIQUE,
  whatsapp TEXT NOT NULL,
  foto_url TEXT,
  ativo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);
