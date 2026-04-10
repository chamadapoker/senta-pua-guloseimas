import { Link } from 'react-router-dom';
import { PublicLayout } from '../components/Layout';

export function Home() {
  return (
    <PublicLayout>
      <div className="py-6 animate-fade-in">
        <div className="text-center mb-10">
          <img src="/logo.png" alt="1/10 GpAv" className="w-28 h-28 mx-auto mb-5 object-contain" />
          <h1 className="font-display text-3xl sm:text-4xl text-azul tracking-wider">SENTA PUA</h1>
          <p className="font-display text-lg sm:text-xl text-vermelho tracking-[0.15em] mt-1">GULOSEIMAS</p>
          <div className="w-16 h-[2px] bg-azul mx-auto mt-4" />
          <p className="text-texto-fraco text-sm mt-4">Escolha sua sala para acessar o cardápio</p>
        </div>

        <div className="space-y-4 max-w-sm mx-auto">
          <Link
            to="/catalogo/oficiais"
            className="group block bg-white rounded-2xl p-5 border border-borda hover:border-azul shadow-sm transition-all duration-300"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-azul/10 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                🎖️
              </div>
              <div className="flex-1">
                <h2 className="font-display text-xl text-azul tracking-wide">SALA DOS OFICIAIS</h2>
                <p className="text-xs text-texto-fraco mt-0.5">Cardápio exclusivo</p>
              </div>
              <span className="text-texto-fraco group-hover:text-azul group-hover:translate-x-1 transition-all">&rarr;</span>
            </div>
          </Link>

          <Link
            to="/catalogo/graduados"
            className="group block bg-white rounded-2xl p-5 border border-borda hover:border-vermelho shadow-sm transition-all duration-300"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-vermelho/10 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                ⭐
              </div>
              <div className="flex-1">
                <h2 className="font-display text-xl text-vermelho tracking-wide">SALA DOS GRADUADOS</h2>
                <p className="text-xs text-texto-fraco mt-0.5">Cardápio exclusivo</p>
              </div>
              <span className="text-texto-fraco group-hover:text-vermelho group-hover:translate-x-1 transition-all">&rarr;</span>
            </div>
          </Link>
        </div>
      </div>
    </PublicLayout>
  );
}
