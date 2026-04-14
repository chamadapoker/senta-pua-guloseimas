ALTER TABLE usuarios ADD COLUMN permite_fiado INTEGER NOT NULL DEFAULT 1;
UPDATE usuarios SET permite_fiado = 0 WHERE is_visitante = 1;
