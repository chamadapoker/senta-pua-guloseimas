-- 026_niver_colunas.sql
-- Adiciona as colunas de homenagem de aniversário usadas pelo código
-- (dashboard do usuário, página admin de aniversariantes e salvar homenagem).
-- Sem elas, essas rotas davam erro 500 ("no such column: niver_titulo").

ALTER TABLE usuarios ADD COLUMN niver_titulo TEXT;
ALTER TABLE usuarios ADD COLUMN niver_texto TEXT;
ALTER TABLE usuarios ADD COLUMN niver_imagem_url TEXT;
