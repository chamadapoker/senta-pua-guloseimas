// Carrega o JSON do esquadrão escolhido no build (VITE_ESQUADRAO, padrão "senta-pua").
// Roda em Node: usado por vite.config.ts e tailwind.config.ts.
import fs from 'node:fs';
import path from 'node:path';
import type { EsquadraoConfig } from './tipo';

export const ESQUADRAO_PADRAO = 'senta-pua';

const CAMPOS_OBRIGATORIOS = [
  'id', 'nome', 'nome_completo', 'sigla_documentos', 'slogan', 'cidade_pix_padrao', 'url_app', 'rodape',
  'cores', 'cor_fundo_pwa', 'imagens', 'salas_cafe', 'salas_cafe_documentos', 'frases', 'areas', 'servidor',
] as const;

export function idEsquadrao(): string {
  return (process.env.VITE_ESQUADRAO || ESQUADRAO_PADRAO).trim();
}

export function arquivoEsquadrao(id = idEsquadrao()): string {
  return path.resolve(__dirname, `${id}.json`);
}

export function carregarEsquadrao(id = idEsquadrao()): EsquadraoConfig {
  if (!/^[a-z0-9-]+$/i.test(id)) {
    throw new Error(`[esquadrao] VITE_ESQUADRAO inválido: "${id}". Use só letras, números e hífen.`);
  }
  const arquivo = arquivoEsquadrao(id);
  if (!fs.existsSync(arquivo)) {
    const disponiveis = fs.readdirSync(path.dirname(arquivo))
      .filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));
    throw new Error(
      `[esquadrao] Arquivo de esquadrão não encontrado: ${arquivo}\n` +
      `VITE_ESQUADRAO="${id}". Disponíveis: ${disponiveis.join(', ') || '(nenhum)'}.\n` +
      `Crie app/esquadroes/${id}.json (veja app/esquadroes/README.md).`
    );
  }
  let dados: EsquadraoConfig;
  try {
    dados = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
  } catch (e) {
    throw new Error(`[esquadrao] JSON inválido em ${arquivo}: ${(e as Error).message}`);
  }
  const faltando = CAMPOS_OBRIGATORIOS.filter((c) => (dados as unknown as Record<string, unknown>)[c] === undefined);
  if (faltando.length) {
    throw new Error(`[esquadrao] ${arquivo} sem os campos obrigatórios: ${faltando.join(', ')}`);
  }
  return dados;
}
