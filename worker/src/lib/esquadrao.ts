// Identidade do esquadrão no servidor. Fonte única: os mesmos app/esquadroes/<id>.json do app,
// embutidos no bundle pelo wrangler (esbuild). O esquadrão é escolhido pela variável ESQUADRAO
// ([vars] / [env.<id>.vars] no wrangler.toml); padrão "senta-pua".
//
// Para um esquadrão novo: crie app/esquadroes/<id>.json e acrescente o import em ESQUADROES abaixo.
import type { EsquadraoConfig } from '../../../app/esquadroes/tipo';
import sentaPua from '../../../app/esquadroes/senta-pua.json';
import exemplo from '../../../app/esquadroes/exemplo.json';
import pantera from '../../../app/esquadroes/pantera.json';

export type { EsquadraoConfig };

export const ESQUADRAO_PADRAO_ID = 'senta-pua';

const ESQUADROES: Record<string, EsquadraoConfig> = {
  'senta-pua': sentaPua satisfies EsquadraoConfig,
  exemplo: exemplo satisfies EsquadraoConfig,
  pantera: pantera satisfies EsquadraoConfig,
};

export const ESQUADRAO_PADRAO: EsquadraoConfig = ESQUADROES[ESQUADRAO_PADRAO_ID];

// Avisa uma vez por isolate para cada id desconhecido (o cron e cada requisição chamam isto)
const avisados = new Set<string>();

/** Ids embutidos no bundle. */
export function esquadroesDisponiveis(): string[] {
  return Object.keys(ESQUADROES);
}

/**
 * Config do esquadrão pelo id (normalmente env.ESQUADRAO). Vazio/ausente => senta-pua.
 * Id desconhecido => senta-pua, com aviso no console.
 */
export function escolherEsquadrao(id: string | undefined | null): EsquadraoConfig {
  const limpo = typeof id === 'string' ? id.trim() : '';
  if (!limpo) return ESQUADRAO_PADRAO;
  const cfg = Object.prototype.hasOwnProperty.call(ESQUADROES, limpo) ? ESQUADROES[limpo] : undefined;
  if (cfg) return cfg;
  if (!avisados.has(limpo)) {
    avisados.add(limpo);
    console.warn(
      `[esquadrao] ESQUADRAO="${limpo}" não existe no bundle; usando "${ESQUADRAO_PADRAO_ID}". ` +
      `Disponíveis: ${esquadroesDisponiveis().join(', ')}.`
    );
  }
  return ESQUADRAO_PADRAO;
}

/** Config do esquadrão do ambiente (env.ESQUADRAO). */
export function esquadraoDoEnv(env: { ESQUADRAO?: string }): EsquadraoConfig {
  return escolherEsquadrao(env.ESQUADRAO);
}

/** Texto da notificação "CAFÉ EM ABERTO" (dia 10) com os marcadores preenchidos. */
export function textoLembreteCafe(cfg: EsquadraoConfig, qtd: number, total: number): string {
  return cfg.servidor.lembrete_cafe_pendente
    .split('{qtd}').join(String(qtd))
    .split('{cobrancas}').join(qtd === 1 ? 'cobrança' : 'cobranças')
    .split('{total}').join(total.toFixed(2).replace('.', ','));
}
