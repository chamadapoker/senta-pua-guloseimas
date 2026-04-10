import type { Produto } from '../../types';
import { useCart } from '../../hooks/useCart';

export function ProductCard({ produto }: { produto: Produto }) {
  const { itens, adicionar } = useCart();
  const itemNoCarrinho = itens.find((i) => i.produto.id === produto.id);
  const quantidade = itemNoCarrinho?.quantidade || 0;

  return (
    <button
      onClick={() => adicionar(produto)}
      className="relative bg-white rounded-xl p-4 text-center active:scale-95 transition-transform border border-gray-100"
    >
      {quantidade > 0 && (
        <span className="absolute -top-2 -right-2 bg-vermelho text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
          {quantidade}
        </span>
      )}
      <div className="text-4xl mb-2">{produto.emoji}</div>
      <div className="font-medium text-texto text-sm">{produto.nome}</div>
      <div className="text-azul font-bold mt-1">R$ {produto.preco.toFixed(2)}</div>
    </button>
  );
}
