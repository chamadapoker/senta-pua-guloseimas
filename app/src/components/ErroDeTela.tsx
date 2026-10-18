import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ESQUADRAO } from '../config/esquadrao';

// Depois de um deploy, os arquivos das telas mudam de nome. Quem estava com a versão antiga
// aberta pede um arquivo que não existe mais e a tela ficava em branco. Nesse caso
// recarregamos sozinhos UMA vez (a marca no sessionStorage evita ficar em loop).
const MARCA = 'recarregou_por_versao';

export function ehErroDeVersao(erro: unknown): boolean {
  const msg = String((erro as { message?: string })?.message ?? erro ?? '');
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported|Failed to fetch dynamically|ChunkLoadError|Loading chunk|MIME type|Unable to preload CSS/i.test(msg);
}

export function recarregarPorVersao(): boolean {
  try {
    const ultima = Number(sessionStorage.getItem(MARCA) || 0);
    if (Date.now() - ultima < 30_000) return false; // já tentou há pouco: mostra a tela de erro
    sessionStorage.setItem(MARCA, String(Date.now()));
  } catch { /* sem storage: tenta mesmo assim */ }
  window.location.reload();
  return true;
}

export async function limparERecarregar() {
  try {
    const regs = await navigator.serviceWorker?.getRegistrations?.();
    await Promise.all((regs ?? []).map(r => r.unregister()));
    const chaves = await caches?.keys?.();
    await Promise.all((chaves ?? []).map(k => caches.delete(k)));
  } catch { /* segue para o reload */ }
  window.location.reload();
}

interface Estado { erro: Error | null }

export class ErroDeTela extends Component<{ children: ReactNode }, Estado> {
  state: Estado = { erro: null };

  static getDerivedStateFromError(erro: Error): Estado {
    return { erro };
  }

  componentDidCatch(erro: Error, info: ErrorInfo) {
    console.error('[ErroDeTela]', erro, info.componentStack);
    if (ehErroDeVersao(erro)) recarregarPorVersao();
  }

  render() {
    const { erro } = this.state;
    if (!erro) return this.props.children;
    const versao = ehErroDeVersao(erro);
    return (
      <div className="min-h-screen bg-noite flex items-center justify-center p-6">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-flutua overflow-hidden">
          <div className="h-1.5 bg-destaque" />
          <div className="p-6 text-center">
            <img src={ESQUADRAO.imagens.brasao} alt="" className="h-14 w-auto mx-auto mb-4" />
            <h1 className="font-display text-2xl text-noite tracking-wide">
              {versao ? 'Nova versão disponível' : 'Algo deu errado nesta tela'}
            </h1>
            <p className="text-sm text-texto-fraco mt-2">
              {versao
                ? 'O sistema foi atualizado enquanto você usava. Recarregue para continuar.'
                : 'Recarregue a página. Se continuar, use "Limpar e recarregar".'}
            </p>
            <div className="grid gap-2 mt-6">
              <button
                onClick={() => window.location.reload()}
                className="min-h-[44px] rounded-xl bg-azul text-white font-medium hover:bg-azul-claro"
              >
                Recarregar
              </button>
              <button
                onClick={limparERecarregar}
                className="min-h-[44px] rounded-xl border border-borda text-texto font-medium hover:bg-fundo"
              >
                Limpar e recarregar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
