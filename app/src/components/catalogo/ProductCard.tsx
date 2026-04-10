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
  const esgotado = !produto.disponivel;

  return (
    <div className={`rounded-2xl overflow-hidden shadow-sm border border-borda group animate-slide-up ${esgotado ? 'opacity-80' : ''}`}>
      <div className="relative aspect-square bg-fundo-elevado">
        {imgSrc ? (
          <img src={imgSrc} alt={produto.nome} className={`w-full h-full object-cover ${esgotado ? 'grayscale' : ''}`} />
        ) : (
          <div className={`w-full h-full flex items-center justify-center text-5xl bg-white ${esgotado ? 'grayscale' : ''}`}>
            {produto.emoji}
          </div>
        )}
        {quantidade > 0 && !esgotado && (
          <span className="absolute top-2 right-2 bg-verde text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shadow">
            {quantidade}
          </span>
        )}
        {esgotado && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-vermelho/90 text-white font-display text-lg tracking-widest px-6 py-2 -rotate-12 shadow-lg">
              ESGOTADO
            </div>
          </div>
        )}
      </div>

      <div className="bg-azul p-3">
        <h3 className="font-medium text-white text-sm leading-tight truncate">{produto.nome}</h3>
        <div className="flex items-center justify-between mt-2">
          <span className="text-white/90 font-bold text-base">
            R$ {produto.preco.toFixed(2).replace('.', ',')}
          </span>
          {esgotado ? (
            <span className="w-11 h-11 rounded-xl bg-white/10 text-white/40 flex items-center justify-center text-[10px] font-medium">
              Esgotado
            </span>
          ) : (
            <button
              onClick={() => adicionar(produto)}
              className="w-11 h-11 rounded-xl bg-verde text-white flex items-center justify-center text-xl font-bold active:scale-90 transition-all hover:bg-verde-escuro shadow"
            >
              +
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
