// Identidade do esquadrão (nome, sigla, cores, imagens, frases, áreas).
// Vem de app/esquadroes/<VITE_ESQUADRAO>.json, escolhido no build (padrão "senta-pua").
// Nunca escreva o nome/sigla/brasão do esquadrão direto no código: use ESQUADRAO.
import type { EsquadraoCarregado } from '../../esquadroes/tipo';

export type { EsquadraoConfig, EsquadraoCarregado, AreaEsquadrao, CorEsquadrao, CorDestaque } from '../../esquadroes/tipo';

export const ESQUADRAO: EsquadraoCarregado = __ESQUADRAO__;

/** Nome em caixa alta (cabeçalhos do menu, login, PDFs). */
export const NOME_MAIUSCULO = ESQUADRAO.nome.toLocaleUpperCase('pt-BR');

/** Texto alternativo padrão do brasão. */
export const ALT_BRASAO = `Brasão do ${ESQUADRAO.nome_completo}`;
