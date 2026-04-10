import { useNavigate } from 'react-router-dom';
import { useCart } from '../../hooks/useCart';

export function CartBar() {
  const { itens, total, totalItens } = useCart();
  const navigate = useNavigate();

  if (itens.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 p-4 animate-slide-up">
      <div className="max-w-lg mx-auto">
        <button
          onClick={() => navigate('/checkout')}
          className="w-full bg-verde text-white font-bold py-4 rounded-2xl text-center active:scale-[0.98] transition-all shadow-lg hover:bg-verde-escuro flex items-center justify-center gap-3"
        >
          <span className="bg-white/20 rounded-lg px-2.5 py-0.5 text-sm">
            {totalItens()}
          </span>
          <span>Ver carrinho</span>
          <span className="font-display text-lg tracking-wide">R$ {total().toFixed(2)}</span>
        </button>
      </div>
    </div>
  );
}
