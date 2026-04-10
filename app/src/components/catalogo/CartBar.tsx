import { useNavigate } from 'react-router-dom';
import { useCart } from '../../hooks/useCart';

export function CartBar() {
  const { itens, total, totalItens } = useCart();
  const navigate = useNavigate();

  if (itens.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-azul p-4 z-40">
      <div className="max-w-lg mx-auto">
        <button
          onClick={() => navigate('/checkout')}
          className="w-full bg-vermelho text-white font-bold py-3 rounded-lg text-center active:scale-[0.98] transition-transform"
        >
          {totalItens()} {totalItens() === 1 ? 'item' : 'itens'} &middot; R$ {total().toFixed(2)} &rarr; Fechar pedido
        </button>
      </div>
    </div>
  );
}
