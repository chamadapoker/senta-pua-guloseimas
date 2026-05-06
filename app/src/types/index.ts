export interface Produto {
  id: string;
  nome: string;
  emoji: string;
  preco: number;
  preco_custo?: number | null;
  disponivel: number;
  ordem: number;
  imagem_url: string | null;
  categoria: 'oficiais' | 'graduados' | 'geral';
  estoque: number | null;
}

export interface Cliente {
  id: string;
  nome_guerra: string;
  saram?: string;
  visitante?: number;
  esquadrao_origem?: string;
  ativo: number;
  created_at: string;
  total_comprado?: number;
  total_pago?: number;
  saldo_devedor?: number;
  ultima_compra?: string;
  usuario_id?: number | null;
  usuario_categoria?: string | null;
  usuario_ativo?: number | null;
}

export interface Pedido {
  id: string;
  cliente_id: string;
  total: number;
  status: 'pendente' | 'pago' | 'fiado';
  metodo_pagamento: 'pix' | 'fiado' | 'dinheiro';
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

export type Categoria = 'oficial' | 'graduado' | 'praca';
export type SalaCafe = 'oficiais' | 'graduados' | null;

export interface Usuario {
  id: number;
  email: string;
  trigrama: string;
  saram: string;
  whatsapp: string;
  foto_url: string | null;
  categoria: Categoria;
  sala_cafe: SalaCafe;
  is_visitante?: number;
  esquadrao_origem?: string | null;
  expira_em?: string | null;
  acesso_pausado?: number;
  acesso_bloqueado?: boolean;
  permite_fiado?: number;
  ativo?: number;
  cliente_id?: string | null;
  created_at?: string;
  data_nascimento?: string | null;
  niver_titulo?: string | null;
  niver_texto?: string | null;
  niver_imagem_url?: string | null;
}

export interface DashboardStats {
  vendido_mes: number;
  recebido_mes: number;
  pendente_total: number;
  vendas_hoje: number;
  devedores: { cliente_id: string; nome_guerra: string; whatsapp: string | null; total_devido: number }[];
  ultimos_7_dias: { data: string; total: number }[];
}
