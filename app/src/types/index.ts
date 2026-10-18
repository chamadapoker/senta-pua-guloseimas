export interface Produto {
  id: string;
  nome: string;
  emoji: string;
  preco: number;
  preco_custo?: number | null;
  disponivel: number;
  ordem: number;
  imagem_url: string | null;
  categoria: 'oficiais' | 'graduados';
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
  is_recepcionista?: number;
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

export interface LojaCategoria {
  id: string;
  nome: string;
  ordem: number;
  total_produtos: number;
}

// ---- Café (contrato novo do backend; campos opcionais para compatibilidade com o antigo) ----
export type SalaCafeTipo = 'oficial' | 'graduado';
export type PlanoCafe = 'mensal' | 'anual';

export interface CafePagamentoMilitar {
  id?: string;
  referencia: string;
  periodo_fim?: string | null; // 'YYYY-MM' (anuidade) ou null
  valor: number;
  status: string;
  rotulo?: string | null; // texto pronto (ex.: "out/2026" ou "Anuidade out/2026 a set/2027")
  paid_at?: string | null;
}

export interface MeuCafeStatus {
  tem_assinatura: boolean;
  tipo: string | null;
  sala?: SalaCafeTipo | null; // null = praça (não participa); ausente = backend antigo
  plano?: PlanoCafe | string;
  valor?: number;
  valor_mensal?: number;
  ativo?: number | boolean;
  valido_ate?: string | null; // 'YYYY-MM' (anual)
  mes_atual?: string;
  mes_atual_pago?: boolean;
  total_pendente?: number;
  historico?: CafePagamentoMilitar[];
  pagamentos?: CafePagamentoMilitar[];
  sem_sala?: boolean;
}
