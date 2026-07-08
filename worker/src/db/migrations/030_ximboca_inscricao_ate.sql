-- Data limite de inscricao/compra de ingresso do evento (YYYY-MM-DD).
-- Nulo = sem limite (aberto ate fechar manualmente).
ALTER TABLE ximboca_eventos ADD COLUMN inscricao_ate TEXT;
