-- 025_separar_cantinas.sql
-- Separação das cantinas: fim do "geral" compartilhado + correção do reabastecimento

-- 1) Move produtos "geral" para a cantina dos Oficiais (decisão de negócio)
UPDATE produtos SET categoria = 'oficiais' WHERE categoria = 'geral';

-- 2) Correção pontual: religa produtos reabastecidos mas presos em ESGOTADO
UPDATE produtos SET disponivel = 1
  WHERE disponivel = 0 AND estoque IS NOT NULL AND estoque > 0;
