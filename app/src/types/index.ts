export interface Produto {
  id: string;
  nome: string;
  emoji: string;
  preco: number;
  disponivel: number;
  ordem: number;
  imagem_url: string | null;
  categoria: 'oficiais' | 'graduados' | 'geral';
  estoque: number | null;
}

export interface Cliente {
  id: string;
  nome_guerra: string;
  ativo: number;
  created_at: string;
  total_comprado?: number;
  total_pago?: number;
  saldo_devedor?: number;
  ultima_compra?: string;
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
  nome_guerra?: string;
  itens_resumo?: string;
}

export interface ItemCarrinho {
  produto: Produto;
  quantidade: number;
}

export interface DashboardStats {
  vendido_mes: number;
  recebido_mes: number;
  pendente_total: number;
  vendas_hoje: number;
  devedores: { cliente_id: string; nome_guerra: string; total_devido: number }[];
  ultimos_7_dias: { data: string; total: number }[];
}
