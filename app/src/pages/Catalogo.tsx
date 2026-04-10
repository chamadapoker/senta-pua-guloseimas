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
      <h1 className="text-xl font-bold text-azul mb-4">Cardápio</h1>
      {loading ? (
        <div className="text-center py-10 text-gray-400">Carregando...</div>
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
