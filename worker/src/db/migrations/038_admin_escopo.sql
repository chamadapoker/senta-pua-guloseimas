-- 038_admin_escopo.sql
-- Escopo do admin: NULL = acesso total (como hoje); 'cafe_graduado' = só o café da sala dos graduados.
-- Só adiciona coluna; não altera dados.
ALTER TABLE admins ADD COLUMN escopo TEXT DEFAULT NULL;
