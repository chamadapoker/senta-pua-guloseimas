// Validação de uploads pelo CONTEÚDO (assinatura / magic bytes), nunca pela extensão ou pelo
// Content-Type informados pelo cliente. O tipo gravado no R2 e a extensão da chave saem daqui.

export type TipoArquivo = 'jpeg' | 'png' | 'webp' | 'gif' | 'pdf';

export const TIPOS_IMAGEM: TipoArquivo[] = ['jpeg', 'png', 'webp', 'gif'];

const INFO: Record<TipoArquivo, { contentType: string; ext: string }> = {
  jpeg: { contentType: 'image/jpeg', ext: 'jpg' },
  png: { contentType: 'image/png', ext: 'png' },
  webp: { contentType: 'image/webp', ext: 'webp' },
  gif: { contentType: 'image/gif', ext: 'gif' },
  pdf: { contentType: 'application/pdf', ext: 'pdf' },
};

/** Content-Types que podem ser servidos publicamente como imagem. */
export const CONTENT_TYPES_IMAGEM = new Set(TIPOS_IMAGEM.map((t) => INFO[t].contentType));

export function contentTypeDe(tipo: TipoArquivo): string {
  return INFO[tipo].contentType;
}

export const TAMANHO_MAX_PADRAO = 5 * 1024 * 1024;

function comeca(b: Uint8Array, sig: number[], offset = 0): boolean {
  if (b.length < offset + sig.length) return false;
  return sig.every((v, i) => b[offset + i] === v);
}

/** Identifica o tipo real do arquivo pelos primeiros bytes. null = desconhecido. */
export function detectarTipo(b: Uint8Array): TipoArquivo | null {
  if (comeca(b, [0xff, 0xd8, 0xff])) return 'jpeg';
  if (comeca(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (comeca(b, [0x52, 0x49, 0x46, 0x46]) && comeca(b, [0x57, 0x45, 0x42, 0x50], 8)) return 'webp'; // RIFF....WEBP
  if (comeca(b, [0x47, 0x49, 0x46, 0x38])) return 'gif'; // GIF8
  if (comeca(b, [0x25, 0x50, 0x44, 0x46])) return 'pdf'; // %PDF
  return null;
}

export type ArquivoValidado = { bytes: ArrayBuffer; tipo: TipoArquivo; contentType: string; ext: string };

/**
 * Valida o arquivo enviado: tamanho máximo e tipo pelo conteúdo, dentro dos tipos aceitos.
 * Devolve os bytes (para gravar) e o contentType/extensão derivados do conteúdo.
 */
export async function validarArquivo(
  file: unknown,
  aceitos: TipoArquivo[],
  maxBytes = TAMANHO_MAX_PADRAO,
): Promise<{ ok: true; arquivo: ArquivoValidado } | { ok: false; erro: string }> {
  if (!file || typeof file === 'string' || typeof (file as File).arrayBuffer !== 'function') {
    return { ok: false, erro: 'Nenhum arquivo enviado' };
  }
  const f = file as File;
  const mb = Math.round(maxBytes / (1024 * 1024));
  if (f.size > maxBytes) return { ok: false, erro: `Arquivo deve ter no máximo ${mb}MB` };
  if (f.size === 0) return { ok: false, erro: 'Arquivo vazio' };

  const bytes = await f.arrayBuffer();
  if (bytes.byteLength > maxBytes) return { ok: false, erro: `Arquivo deve ter no máximo ${mb}MB` };
  const tipo = detectarTipo(new Uint8Array(bytes, 0, Math.min(bytes.byteLength, 16)));
  if (!tipo || !aceitos.includes(tipo)) {
    const nomes = aceitos.map((t) => INFO[t].ext.toUpperCase()).join(', ');
    return { ok: false, erro: `Formato não suportado. Use: ${nomes}` };
  }
  return { ok: true, arquivo: { bytes, tipo, ...INFO[tipo] } };
}
