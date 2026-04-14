-- Adiciona preco_custo em produtos da cantina e loja para calculo de margem
ALTER TABLE produtos ADD COLUMN preco_custo REAL DEFAULT NULL;
ALTER TABLE loja_produtos ADD COLUMN preco_custo REAL DEFAULT NULL;
