import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../services/api';
import type { Produto } from '../types';
import { PublicLayout } from '../components/Layout';
import { ProductCard } from '../components/catalogo/ProductCard';
import { CartBar } from '../components/catalogo/CartBar';

const TITULOS: Record<string, string> = {
  oficiais: 'SALA DOS OFICIAIS',
  graduados: 'SALA DOS GRADUADOS',
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

  const titulo = categoria ? TITULOS[categoria] || 'CARDÁPIO' : 'CARDÁPIO';

  return (
    <PublicLayout>
      <div className="mb-5">
        <h1 className="font-display text-2xl text-azul tracking-wider">{titulo}</h1>
        <p className="text-sm text-texto-fraco mt-1">Toque no + para adicionar ao pedido</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-2xl overflow-hidden border border-borda animate-pulse">
              <div className="aspect-square bg-gray-100" />
              <div className="bg-azul/30 p-3 space-y-2">
                <div className="h-4 bg-white/20 rounded w-3/4" />
                <div className="h-5 bg-white/20 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : produtos.length === 0 ? (
        <div className="text-center py-16 text-texto-fraco">Nenhum produto disponível</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 pb-28">
          {produtos.map((p, i) => (
            <div key={p.id} style={{ animationDelay: `${i * 60}ms` }}>
              <ProductCard produto={p} />
            </div>
          ))}
        </div>
      )}

      <CartBar />
    </PublicLayout>
  );
}
