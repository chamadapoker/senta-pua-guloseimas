-- 028_data_nascimento.sql
-- Versiona a coluna usuarios.data_nascimento, que era usada pelo código mas nunca
-- teve migration (foi adicionada ad-hoc em produção).
--
-- ATENÇÃO: NÃO rodar em produção — a coluna JÁ EXISTE lá (este ALTER falharia com
-- "duplicate column name"). Este arquivo serve para reproduzir o schema correto em
-- bancos NOVOS (rebuild a partir de schema.sql + migrations em ordem).

ALTER TABLE usuarios ADD COLUMN data_nascimento TEXT;
