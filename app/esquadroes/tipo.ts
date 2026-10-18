// Formato do arquivo de identidade de um esquadrão (app/esquadroes/<id>.json).
// Usado pelo app (src/config/esquadrao.ts) e pelos configs de build (vite/tailwind).

export type CorEsquadrao = 'noite' | 'noite-2' | 'noite-3' | 'faixa' | 'escarlate' | 'noite-texto' | 'noite-fraco';
export type AreaEsquadrao = 'cantina' | 'loja' | 'cafe' | 'ximboca' | 'inventario';

export interface EsquadraoConfig {
  /** Identificador (igual ao nome do arquivo, sem .json). */
  id: string;
  /** Nome curto exibido no app (ex.: "Senta Pua"). */
  nome: string;
  /** Nome completo/sigla da unidade (ex.: "1/10 GpAv"). */
  nome_completo: string;
  /** Sigla usada em PDFs e mensagens de cobrança (ex.: "1/10 GAV"). */
  sigla_documentos: string;
  /** Lema/descrição (meta description, manifest, og:description). */
  slogan: string;
  /** Cidade usada no PIX quando o admin não configurou uma. */
  cidade_pix_padrao: string;
  /** URL pública do app (og:url). */
  url_app: string;
  /** Texto do rodapé. */
  rodape: string;
  /** Paleta do brasão (menu e navegação). */
  cores: Record<CorEsquadrao, string>;
  /** Cor de fundo da tela de abertura do PWA (manifest background_color). */
  cor_fundo_pwa: string;
  imagens: {
    brasao: string;
    brasao_grande: string;
    logo: string;
    og_image: string;
  };
  /** Nomes padrão das salas do café (quando o admin não definiu um nome). */
  salas_cafe: { oficial: string; graduado: string };
  /** Nomes padrão das salas usados nos PDFs e no formulário de PIX do café. */
  salas_cafe_documentos: { oficial: string; graduado: string };
  frases: {
    /** Grito/saudação (botão do aniversário). */
    saudacao: string;
    /** Fecho da mensagem de cobrança no WhatsApp. */
    cobranca: string;
    /** Frases sorteadas ao registrar um fiado. */
    fiado: string[];
    /** Frases sorteadas quando o PIX é confirmado. */
    pix_pago: string[];
  };
  /** Áreas do sistema habilitadas (preparado para desligar áreas no futuro). */
  areas: Record<AreaEsquadrao, boolean>;
  /** Textos gerados pelo servidor (worker): notificações do cron e homenagem padrão. */
  servidor: {
    /** Frases sorteadas na notificação "MENSALIDADE CAFÉ" (cron, dias 1 a 5). */
    mensalidade_cafe: string[];
    /** Frases sorteadas na notificação "ANUIDADE CAFÉ" (o período é acrescentado ao final). */
    anuidade_cafe: string[];
    /** Notificação "FELIZ ANIVERSÁRIO!" enviada pelo cron no dia do aniversário. */
    aniversario_notificacao: string;
    /** Texto padrão da homenagem de aniversário quando o admin não personalizou. */
    aniversario_homenagem: string;
    /**
     * Notificação "CAFÉ EM ABERTO" do dia 10. Marcadores: {qtd} (número), {cobrancas}
     * ("cobrança"/"cobranças") e {total} (valor já formatado, ex.: "40,00").
     */
    lembrete_cafe_pendente: string;
  };
}
