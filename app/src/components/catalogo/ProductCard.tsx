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
    <div className="bg-white rounded-xl overflow-hidden border border-gray-100">
      <div className="relative aspect-square bg-gray-50">
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={produto.nome}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl">
            {produto.emoji}
          </div>
        )}
        {quantidade > 0 && (
          <span className="absolute top-2 right-2 bg-vermelho text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shadow">
            {quantidade}
          </span>
        )}
      </div>

      <div className="p-3">
        <h3 className="font-semibold text-texto text-sm leading-tight truncate">{produto.nome}</h3>
        <div className="flex items-center justify-between mt-2">
          <span className="text-azul font-bold text-base">
            R$ {produto.preco.toFixed(2).replace('.', ',')}
          </span>
          <button
            onClick={() => adicionar(produto)}
            className="w-8 h-8 rounded-full bg-vermelho text-white flex items-center justify-center text-lg font-bold active:scale-90 transition-transform shadow-sm"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}
