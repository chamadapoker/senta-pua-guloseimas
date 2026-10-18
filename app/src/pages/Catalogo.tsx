import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../services/api';
import { getConfig } from '../services/config';
import type { Produto } from '../types';
import { AppLayout } from '../components/AppLayout';
import { BackButton } from '../components/ui/BackButton';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { ProductCard } from '../components/catalogo/ProductCard';
import { CartBar } from '../components/catalogo/CartBar';
import { useCart } from '../hooks/useCart';

const TITULO_PADRAO: Record<string, string> = {
  oficiais: 'Cantina dos Oficiais',
  graduados: 'Cantina dos Graduados',
};

const GRADE = 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3';

export function Catalogo() {
  const { categoria } = useParams<{ categoria: string }>();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(false);
  const [titulo, setTitulo] = useState(() => TITULO_PADRAO[categoria ?? ''] ?? 'Cantina');
  const temCarrinho = useCart((s) => s.itens.length > 0);

  useEffect(() => {
    setTitulo(TITULO_PADRAO[categoria ?? ''] ?? 'Cantina');
    getConfig().then((c) => {
      if (categoria === 'oficiais' && c.nome_sala_oficiais) setTitulo(c.nome_sala_oficiais);
      if (categoria === 'graduados' && c.nome_sala_graduados) setTitulo(c.nome_sala_graduados);
    }).catch(() => {});
  }, [categoria]);

  const carregar = useCallback(() => {
    setLoading(true);
    setErro(false);
    const query = categoria ? `?categoria=${categoria}` : '';
    api.get<Produto[]>(`/api/produtos${query}`)
      .then((p) => { setProdutos(p); setErro(false); })
      .catch(() => setErro(true))
      .finally(() => setLoading(false));
  }, [categoria]);

  useEffect(() => { carregar(); }, [carregar]);

  return (
    <AppLayout>
      <BackButton to="/" className="min-h-[44px] mb-1" />
      <PageHeader
        title={titulo}
        subtitle="Toque em Adicionar e feche o pedido no carrinho."
      />

      {loading ? (
        <div className={GRADE} aria-busy="true" aria-label="Carregando produtos">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl overflow-hidden border border-borda animate-pulse">
              <div className="aspect-[4/3] bg-fundo-elevado" />
              <div className="p-3 space-y-2.5">
                <div className="h-4 bg-fundo-elevado rounded w-3/4" />
                <div className="h-6 bg-fundo-elevado rounded w-1/2" />
                <div className="h-11 bg-fundo-elevado rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      ) : erro ? (
        <EmptyState
          icon={<Icon name="warning" size={24} />}
          message="Não foi possível carregar os produtos"
          hint="Confira sua conexão e tente de novo."
          action={<Button variant="outline" onClick={carregar}><Icon name="refresh" size={16} /> Tentar de novo</Button>}
        />
      ) : produtos.length === 0 ? (
        <EmptyState
          icon={<Icon name="cutlery" size={24} />}
          message="Nenhum produto disponível agora"
          hint="A cantina ainda não cadastrou produtos ou está sendo reabastecida."
          action={<Link to="/" className="inline-flex items-center min-h-[44px] px-5 rounded-xl border border-borda bg-white font-medium hover:bg-fundo-elevado">Voltar ao início</Link>}
        />
      ) : (
        <div className={`${GRADE} ${temCarrinho ? 'pb-28' : 'pb-4'}`}>
          {produtos.map((p) => (
            <ProductCard key={p.id} produto={p} />
          ))}
        </div>
      )}

      <CartBar />
    </AppLayout>
  );
}
