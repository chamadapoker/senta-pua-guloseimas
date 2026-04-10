import { useEffect, useState } from 'react';
import { api } from '../services/api';
import type { Produto } from '../types';
import { PublicLayout } from '../components/Layout';
import { ProductCard } from '../components/catalogo/ProductCard';
import { CartBar } from '../components/catalogo/CartBar';

export function Catalogo() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Produto[]>('/api/produtos')
      .then(setProdutos)
      .finally(() => setLoading(false));
  }, []);

  return (
    <PublicLayout>
      <div className="mb-4">
        <h1 className="text-xl font-bold text-azul">Cardápio</h1>
        <p className="text-sm text-gray-500">Escolha seus itens e feche o pedido</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-xl overflow-hidden border border-gray-100 animate-pulse">
              <div className="aspect-square bg-gray-200" />
              <div className="p-3 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-5 bg-gray-200 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 pb-24">
          {produtos.map((p) => (
            <ProductCard key={p.id} produto={p} />
          ))}
        </div>
      )}

      <CartBar />
    </PublicLayout>
  );
}
