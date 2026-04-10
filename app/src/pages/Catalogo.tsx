import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../services/api';
import type { Produto } from '../types';
import { PublicLayout } from '../components/Layout';
import { ProductCard } from '../components/catalogo/ProductCard';
import { CartBar } from '../components/catalogo/CartBar';

const TITULOS: Record<string, string> = {
  oficiais: 'Sala dos Oficiais',
  graduados: 'Sala dos Graduados',
};

export function Catalogo() {
  const { categoria } = useParams<{ categoria: string }>();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const query = categoria ? `?categoria=${categoria}` : '';
    api.get<Produto[]>(`/api/produtos${query}`)
      .then(setProdutos)
      .finally(() => setLoading(false));
  }, [categoria]);

  const titulo = categoria ? TITULOS[categoria] || 'Cardápio' : 'Cardápio';

  return (
    <PublicLayout>
      <div className="mb-4">
        <h1 className="text-xl font-bold text-azul">{titulo}</h1>
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
      ) : produtos.length === 0 ? (
        <div className="text-center py-12 text-gray-400">Nenhum produto disponível</div>
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
