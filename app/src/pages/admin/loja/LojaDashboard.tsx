import { AdminLayout } from '../../../components/Layout';

export function LojaDashboard() {
  return (
    <AdminLayout>
      <h1 className="font-display text-2xl text-azul tracking-wider mb-5">LOJA MILITAR</h1>

      <div className="bg-white rounded-2xl p-8 border border-borda shadow-sm text-center">
        <div className="w-20 h-20 mx-auto rounded-full bg-azul/10 flex items-center justify-center text-4xl mb-4">🎽</div>
        <h2 className="font-display text-xl text-azul tracking-wider mb-2">EM CONSTRUÇÃO</h2>
        <p className="text-texto-fraco text-sm max-w-md mx-auto">
          Sistema de venda de artigos militares — camisas, canecas, abridores, facas e mais.
          Com controle de estoque, tamanhos e variações.
        </p>
      </div>
    </AdminLayout>
  );
}
