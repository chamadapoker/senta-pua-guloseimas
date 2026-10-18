import { useEffect, useState } from 'react';
import { api } from '../services/api';

/**
 * Carrega um arquivo protegido (ex.: /api/comprovantes/:id/imagem) com fetch autenticado e devolve
 * um object URL para usar em <img src>. O URL é revogado ao trocar de arquivo ou desmontar.
 * Não use <img src> direto nessas rotas: o navegador não envia o token.
 */
export function useImagemProtegida(url: string | null | undefined) {
  const [src, setSrc] = useState<string | null>(null);
  const [erro, setErro] = useState(false);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    setSrc(null);
    setErro(false);
    if (!url) { setCarregando(false); return; }
    let ativo = true;
    let objectUrl: string | null = null;
    setCarregando(true);
    api.blob(url)
      .then((b) => {
        if (!ativo) return;
        objectUrl = URL.createObjectURL(b);
        setSrc(objectUrl);
      })
      .catch(() => { if (ativo) setErro(true); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => {
      ativo = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  return { src, erro, carregando };
}

/**
 * Abre um arquivo protegido (ex.: PDF de comprovante) em nova aba via blob.
 * A aba é aberta antes do fetch (senão o navegador bloqueia como pop-up) e recebe o blob depois.
 */
export async function abrirArquivoProtegido(url: string): Promise<void> {
  const aba = window.open('', '_blank');
  if (aba) aba.opener = null;
  try {
    const blob = await api.blob(url);
    const objectUrl = URL.createObjectURL(blob);
    if (aba) aba.location.href = objectUrl;
    else window.open(objectUrl, '_blank', 'noopener');
    // Dá tempo da aba carregar antes de revogar
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  } catch (e) {
    aba?.close();
    throw e;
  }
}
