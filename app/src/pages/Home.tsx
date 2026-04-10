import { Link } from 'react-router-dom';
import { PublicLayout } from '../components/Layout';

export function Home() {
  return (
    <PublicLayout>
      <div className="py-8">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="1/10 GpAv" className="w-24 h-24 mx-auto mb-4 object-contain" />
          <h1 className="text-2xl font-bold text-azul">Senta Pua Guloseimas</h1>
          <p className="text-gray-500 text-sm mt-1">Escolha sua sala</p>
        </div>

        <div className="grid grid-cols-1 gap-4 max-w-sm mx-auto">
          <Link
            to="/catalogo/oficiais"
            className="bg-white rounded-xl p-6 text-center border-2 border-transparent hover:border-azul active:scale-[0.98] transition-all"
          >
            <div className="text-4xl mb-3">🎖️</div>
            <h2 className="text-lg font-bold text-azul">Sala dos Oficiais</h2>
            <p className="text-sm text-gray-500 mt-1">Cardápio exclusivo</p>
          </Link>

          <Link
            to="/catalogo/graduados"
            className="bg-white rounded-xl p-6 text-center border-2 border-transparent hover:border-vermelho active:scale-[0.98] transition-all"
          >
            <div className="text-4xl mb-3">⭐</div>
            <h2 className="text-lg font-bold text-vermelho">Sala dos Graduados</h2>
            <p className="text-sm text-gray-500 mt-1">Cardápio exclusivo</p>
          </Link>
        </div>
      </div>
    </PublicLayout>
  );
}
