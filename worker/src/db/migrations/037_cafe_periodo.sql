-- 037_cafe_periodo.sql
-- Plano anual = 12 meses a partir da adesão.
-- Anuidade nova: referencia = mês de início ('YYYY-MM') e periodo_fim = início + 11 meses ('YYYY-MM').
-- Anuidades antigas (referencia 'YYYY', periodo_fim NULL) continuam valendo como YYYY-01..YYYY-12.
-- Só adiciona coluna e índice; não altera dados.
ALTER TABLE cafe_pagamentos ADD COLUMN periodo_fim TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_cafe_pagamentos_assinante_ref ON cafe_pagamentos(assinante_id, referencia);
