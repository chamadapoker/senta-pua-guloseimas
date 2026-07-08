-- Loja: entrega por retirada no local (padrao) ou envio (com endereco + frete a combinar).
ALTER TABLE loja_pedidos ADD COLUMN entrega_tipo TEXT NOT NULL DEFAULT 'retirada'; -- 'retirada' | 'envio'
ALTER TABLE loja_pedidos ADD COLUMN endereco     TEXT;      -- endereco de entrega (envio)
ALTER TABLE loja_pedidos ADD COLUMN frete        REAL;      -- valor do frete (admin define; NULL = a combinar)
ALTER TABLE loja_pedidos ADD COLUMN envio_status TEXT;      -- NULL (retirada) | 'a_enviar' | 'enviado'
ALTER TABLE loja_pedidos ADD COLUMN rastreamento TEXT;      -- codigo de rastreio (opcional)

-- Taxa de frete configuravel pelo admin (Regras da Loja). 0 = sem envio.
INSERT OR IGNORE INTO configuracoes (chave, valor) VALUES ('loja_frete', '0.00');
