-- PIX por evento: cada ximboca pode ter responsável diferente
ALTER TABLE ximboca_eventos ADD COLUMN pix_chave TEXT DEFAULT NULL;
ALTER TABLE ximboca_eventos ADD COLUMN pix_tipo TEXT DEFAULT NULL; -- cpf | email | telefone | aleatoria
ALTER TABLE ximboca_eventos ADD COLUMN pix_nome TEXT DEFAULT NULL;
ALTER TABLE ximboca_eventos ADD COLUMN pix_whatsapp TEXT DEFAULT NULL;
