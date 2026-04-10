import { create } from 'zustand';
import type { Produto, ItemCarrinho } from '../types';

interface CartState {
  itens: ItemCarrinho[];
  adicionar: (produto: Produto) => void;
  remover: (produtoId: string) => void;
  alterarQuantidade: (produtoId: string, quantidade: number) => void;
  limpar: () => void;
  total: () => number;
  totalItens: () => number;
}

export const useCart = create<CartState>((set, get) => ({
  itens: [],

  adicionar: (produto) =>
    set((state) => {
      const existente = state.itens.find((i) => i.produto.id === produto.id);
      if (existente) {
        return {
          itens: state.itens.map((i) =>
            i.produto.id === produto.id ? { ...i, quantidade: i.quantidade + 1 } : i
          ),
        };
      }
      return { itens: [...state.itens, { produto, quantidade: 1 }] };
    }),

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
}));
