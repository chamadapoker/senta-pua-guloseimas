ALTER TABLE usuarios ADD COLUMN categoria TEXT NOT NULL DEFAULT 'praca';
ALTER TABLE usuarios ADD COLUMN sala_cafe TEXT;

UPDATE usuarios SET sala_cafe = NULL WHERE categoria = 'praca';
