import type { Produto } from '../../types';
import { useCart } from '../../hooks/useCart';

const WORKER_URL = import.meta.env.VITE_WORKER_URL || '';

function resolveImg(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith('/api') ? `${WORKER_URL}${url}` : url;
}

export function ProductCard({ produto }: { produto: Produto }) {
  const { itens, adicionar } = useCart();
  const itemNoCarrinho = itens.find((i) => i.produto.id === produto.id);
  const quantidade = itemNoCarrinho?.quantidade || 0;
  const imgSrc = resolveImg(produto.imagem_url);

  return (
    <div className="rounded-2xl overflow-hidden border border-borda group animate-slide-up">
      <div className="relative aspect-square bg-fundo-elevado">
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={produto.nome}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl bg-fundo-card">
            {produto.emoji}
          </div>
        )}
        {quantidade > 0 && (
          <span className="absolute top-2 right-2 bg-vermelho text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shadow-lg shadow-vermelho/40 animate-slide-up">
            {quantidade}
          </span>
        )}
      </div>

      {/* Info bar azul */}
      <div className="bg-azul p-3">
        <h3 className="font-medium text-white text-sm leading-tight truncate">{produto.nome}</h3>
        <div className="flex items-center justify-between mt-2">
          <span className="text-dourado-claro font-bold text-base font-display tracking-wide">
            R$ {produto.preco.toFixed(2).replace('.', ',')}
          </span>
          <button
            onClick={() => adicionar(produto)}
            className="w-9 h-9 rounded-xl bg-vermelho text-white flex items-center justify-center text-lg font-bold active:scale-90 transition-all shadow-lg shadow-vermelho/30 hover:shadow-vermelho/50"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}
