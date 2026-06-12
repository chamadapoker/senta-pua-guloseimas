import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../services/api';
import { getConfig } from '../services/config';
import type { Produto } from '../types';
import { AppLayout } from '../components/AppLayout';
import { BackButton } from '../components/ui/BackButton';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { ProductCard } from '../components/catalogo/ProductCard';
import { CartBar } from '../components/catalogo/CartBar';

export function Catalogo() {
  const { categoria } = useParams<{ categoria: string }>();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(false);
  const [titulo, setTitulo] = useState('CATÁLOGO');

  useEffect(() => {
    getConfig().then((c) => {
      if (categoria === 'oficiais' && c.nome_sala_oficiais) setTitulo(c.nome_sala_oficiais.toUpperCase());
      if (categoria === 'graduados' && c.nome_sala_graduados) setTitulo(c.nome_sala_graduados.toUpperCase());
    }).catch(() => {});
  }, [categoria]);

  useEffect(() => {
    setLoading(true);
    const query = categoria ? `?categoria=${categoria}` : '';
    api.get<Produto[]>(`/api/produtos${query}`)
      .then((p) => { setProdutos(p); setErro(false); })
      .catch(() => setErro(true))
      .finally(() => setLoading(false));
  }, [categoria]);

  return (
    <AppLayout>
      <BackButton to="/" className="mb-3" />
      <PageHeader title={titulo} subtitle="Toque no + para adicionar ao pedido" />

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
      ) : erro ? (
        <div className="text-center py-16 text-vermelho">
          Erro ao carregar os produtos.{' '}
          <button onClick={() => window.location.reload()} className="underline">Tentar de novo</button>
        </div>
      ) : produtos.length === 0 ? (
        <EmptyState message="Nenhum produto disponível" />
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
    </AppLayout>
  );
}
