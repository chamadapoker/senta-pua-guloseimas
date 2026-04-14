-- Multi-admin com senha hash (PBKDF2) + roles
CREATE TABLE IF NOT EXISTS admins (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email       TEXT NOT NULL UNIQUE,
  senha_hash  TEXT NOT NULL,
  nome        TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('super_admin', 'admin')),
  ativo       INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  created_by  TEXT DEFAULT NULL,
  last_login  TEXT DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);
