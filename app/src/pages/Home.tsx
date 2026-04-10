import { Link } from 'react-router-dom';
import { PublicLayout } from '../components/Layout';

export function Home() {
  return (
    <PublicLayout>
      <div className="py-6 animate-fade-in">
        <div className="text-center mb-10">
          <img src="/logo.png" alt="1/10 GpAv" className="w-28 h-28 mx-auto mb-5 object-contain drop-shadow-2xl" />
          <h1 className="font-display text-4xl text-white tracking-wider">SENTA PUA</h1>
          <p className="font-display text-xl text-dourado tracking-[0.15em] mt-1">GULOSEIMAS</p>
          <div className="w-16 h-[2px] bg-gradient-to-r from-transparent via-vermelho to-transparent mx-auto mt-4" />
          <p className="text-texto-fraco text-sm mt-4">Escolha sua sala para acessar o cardápio</p>
        </div>

        <div className="space-y-4 max-w-sm mx-auto">
          <Link
            to="/catalogo/oficiais"
            className="group block bg-fundo-card rounded-2xl p-6 border border-borda hover:border-dourado/50 transition-all duration-300"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-azul/20 border border-azul/30 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                🎖️
              </div>
              <div className="flex-1">
                <h2 className="font-display text-xl text-white tracking-wide">SALA DOS OFICIAIS</h2>
                <p className="text-xs text-texto-fraco mt-0.5">Cardápio exclusivo</p>
              </div>
              <span className="text-texto-fraco group-hover:text-dourado group-hover:translate-x-1 transition-all">&rarr;</span>
            </div>
          </Link>

          <Link
            to="/catalogo/graduados"
            className="group block bg-fundo-card rounded-2xl p-6 border border-borda hover:border-vermelho/50 transition-all duration-300"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-vermelho/15 border border-vermelho/30 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                ⭐
              </div>
              <div className="flex-1">
                <h2 className="font-display text-xl text-white tracking-wide">SALA DOS GRADUADOS</h2>
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
