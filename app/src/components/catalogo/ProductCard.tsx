import type { Produto } from '../../types';
import { useCart } from '../../hooks/useCart';
import { useToast } from '../../hooks/useToast';
import { Icon } from '../ui/Icon';

const WORKER_URL = import.meta.env.VITE_WORKER_URL || '';

function resolveImg(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith('/api') ? `${WORKER_URL}${url}` : url;
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function ProductCard({ produto }: { produto: Produto }) {
  const { itens, adicionar, alterarQuantidade, remover } = useCart();
  const { showToast } = useToast();
  const itemNoCarrinho = itens.find((i) => i.produto.id === produto.id);
  const quantidade = itemNoCarrinho?.quantidade || 0;
  const imgSrc = resolveImg(produto.imagem_url);
  const esgotado = !produto.disponivel;

  const add = () => {
    if (adicionar(produto)) {
      showToast('Carrinho anterior (de outra cantina) foi esvaziado', 'warning');
    }
  };
  const menos = () => {
    if (quantidade <= 1) remover(produto.id);
    else alterarQuantidade(produto.id, quantidade - 1);
  };

  return (
    <article
      className={`flex flex-col h-full bg-white rounded-2xl overflow-hidden border ${quantidade > 0 && !esgotado ? 'border-azul' : 'border-borda'}`}
      aria-label={produto.nome}
    >
      <div className="relative aspect-[4/3] bg-fundo-elevado">
        {imgSrc ? (
          <img src={imgSrc} alt="" loading="lazy" className={`w-full h-full object-cover ${esgotado ? 'grayscale opacity-60' : ''}`} />
        ) : (
          <div className={`w-full h-full flex items-center justify-center text-5xl ${esgotado ? 'grayscale opacity-60' : ''}`} aria-hidden="true">
            {produto.emoji}
          </div>
        )}
        {esgotado && (
          <span className="absolute top-2 left-2 bg-noite text-white text-xs font-semibold px-2.5 py-1 rounded-lg">
            Esgotado
          </span>
        )}
      </div>

      <div className="flex flex-col flex-1 p-3">
        <h3 className={`text-[15px] font-medium leading-snug line-clamp-2 ${esgotado ? 'text-texto-fraco' : 'text-texto'}`}>{produto.nome}</h3>
        <p className={`font-display text-2xl leading-none tracking-wide mt-1.5 ${esgotado ? 'text-texto-fraco line-through decoration-1' : 'text-noite'}`}>
          {brl(produto.preco)}
        </p>

        <div className="mt-auto pt-3">
          {esgotado ? (
            <p className="min-h-[44px] flex items-center justify-center rounded-xl bg-fundo-elevado text-sm text-texto-fraco">
              Indisponível
            </p>
          ) : quantidade > 0 ? (
            <div className="flex items-center justify-between gap-1 rounded-xl bg-azul text-white">
              <button
                type="button"
                onClick={menos}
                aria-label={quantidade <= 1 ? `Tirar ${produto.nome} do carrinho` : `Diminuir ${produto.nome}`}
                className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-azul-claro active:scale-90 transition-transform outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                {quantidade <= 1 ? <Icon name="trash" size={18} /> : <span className="text-2xl leading-none" aria-hidden="true">−</span>}
              </button>
              <span className="font-display text-2xl leading-none tabular-nums" aria-live="polite" aria-label={`${quantidade} no carrinho`}>{quantidade}</span>
              <button
                type="button"
                onClick={add}
                aria-label={`Adicionar mais um ${produto.nome}`}
                className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-azul-claro active:scale-90 transition-transform outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                <Icon name="plus" size={20} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={add}
              className="w-full min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-verde text-white font-semibold hover:bg-verde-escuro active:scale-[0.97] transition-[background-color,transform] outline-none focus-visible:ring-2 focus-visible:ring-verde/40 focus-visible:ring-offset-2"
            >
              <Icon name="plus" size={18} /> Adicionar
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
