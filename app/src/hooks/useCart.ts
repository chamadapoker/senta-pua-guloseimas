import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Produto, ItemCarrinho } from '../types';

interface CartState {
  itens: ItemCarrinho[];
  /** Retorna true quando o carrinho foi limpo por ser de outra cantina. */
  adicionar: (produto: Produto) => boolean;
  remover: (produtoId: string) => void;
  alterarQuantidade: (produtoId: string, quantidade: number) => void;
  limpar: () => void;
  total: () => number;
  totalItens: () => number;
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      itens: [],

      adicionar: (produto) => {
        // Carrinho é por cantina: ao adicionar item de outra categoria, recomeça
        // (não dá para fechar um pedido misturando Oficiais e Graduados).
        const atual = get().itens;
        const outraCantina = atual.length > 0 && atual[0].produto.categoria !== produto.categoria;
        const base = outraCantina ? [] : atual;

        const existente = base.find((i) => i.produto.id === produto.id);
        if (existente) {
          set({
            itens: base.map((i) =>
              i.produto.id === produto.id ? { ...i, quantidade: i.quantidade + 1 } : i
            ),
          });
        } else {
          set({ itens: [...base, { produto, quantidade: 1 }] });
        }
        return outraCantina;
      },

      remover: (produtoId) =>
        set((state) => ({
          itens: state.itens.filter((i) => i.produto.id !== produtoId),
        })),

      alterarQuantidade: (produtoId, quantidade) =>
        set((state) => {
          if (quantidade <= 0) {
            return { itens: state.itens.filter((i) => i.produto.id !== produtoId) };
          }
          return {
            itens: state.itens.map((i) =>
              i.produto.id === produtoId ? { ...i, quantidade } : i
            ),
          };
        }),

      limpar: () => set({ itens: [] }),

      total: () =>
        get().itens.reduce((sum, i) => sum + i.produto.preco * i.quantidade, 0),

      totalItens: () =>
        get().itens.reduce((sum, i) => sum + i.quantidade, 0),
    }),
    {
      name: 'carrinho',
      storage: createJSONStorage(() => localStorage),
      // Só os itens vão para o localStorage (funções não são serializáveis)
      partialize: (state) => ({ itens: state.itens }),
      version: 1,
    }
  )
);
