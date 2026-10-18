import { useNavigate } from 'react-router-dom';
import { useCart } from '../../hooks/useCart';
import { Icon } from '../ui/Icon';

export function CartBar() {
  const { itens, total, totalItens } = useCart();
  const navigate = useNavigate();

  if (itens.length === 0) return null;
  const qtd = totalItens();

  return (
    <div className="fixed acima-nav left-0 right-0 z-30 px-4 pb-3 lg:pb-4 animate-slide-up pointer-events-none">
      <div className="max-w-lg mx-auto pointer-events-auto">
        <button
          onClick={() => navigate('/checkout')}
          className="w-full min-h-[60px] bg-noite text-white rounded-2xl pl-4 pr-3 flex items-center gap-3 shadow-flutua active:scale-[0.98] transition-transform hover:bg-noite-2 outline-none focus-visible:ring-2 focus-visible:ring-azul/50 focus-visible:ring-offset-2"
        >
          <span className="relative">
            <Icon name="cart" size={24} />
            <span className="absolute -top-2 -right-2.5 min-w-[20px] h-5 px-1 rounded-full bg-escarlate text-white text-xs font-bold flex items-center justify-center tabular-nums">
              {qtd}
            </span>
          </span>
          <span className="flex-1 text-left pl-2">
            <span className="block text-xs text-noite-texto leading-tight">{qtd} {qtd === 1 ? 'item' : 'itens'}</span>
            <span className="block font-display text-2xl leading-none tracking-wide">
              {total().toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5 bg-verde rounded-xl px-4 min-h-[44px] font-semibold text-[15px]">
            Ver carrinho <Icon name="chevron-right" size={16} />
          </span>
        </button>
      </div>
    </div>
  );
}
