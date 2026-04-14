ALTER TABLE usuarios ADD COLUMN is_visitante INTEGER NOT NULL DEFAULT 0;
ALTER TABLE usuarios ADD COLUMN esquadrao_origem TEXT;
ALTER TABLE usuarios ADD COLUMN expira_em TEXT;
ALTER TABLE usuarios ADD COLUMN acesso_pausado INTEGER NOT NULL DEFAULT 0;

INSERT OR IGNORE INTO configuracoes (chave, valor) VALUES
  ('cafe_visitante_oficial_valor', '20.00'),
  ('cafe_visitante_graduado_valor', '20.00');
