export interface Produto {
  id: string;
  nome: string;
  emoji: string;
  preco: number;
  disponivel: number;
  ordem: number;
  imagem_url: string | null;
  created_at: string;
}

export interface Cliente {
  id: string;
  nome_guerra: string;
  ativo: number;
  created_at: string;
}

export interface Pedido {
  id: string;
  cliente_id: string;
  total: number;
  status: 'pendente' | 'pago' | 'fiado';
  metodo_pagamento: 'pix' | 'fiado';
  pix_payment_id: string | null;
  created_at: string;
  paid_at: string | null;
}

export interface ItemPedido {
  id: string;
  pedido_id: string;
  produto_id: string | null;
  nome_produto: string;
  preco_unitario: number;
  quantidade: number;
  subtotal: number;
}

export interface Admin {
  id: string;
  email: string;
  senha_hash: string;
}
