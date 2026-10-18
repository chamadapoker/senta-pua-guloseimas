import { Link } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { AtalhosHome, HeroSentaPua } from '../components/catalogo/AtalhosHome';
import { useUserAuth } from '../hooks/useUserAuth';
import { Dashboard } from './Dashboard';

export function Home() {
  const { user } = useUserAuth();

  // Logado: a página inicial é o painel (herói, o que deve e atalhos)
  if (user) return <Dashboard />;

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <h1 className="sr-only">Senta Pua, app do 1/10 GpAv</h1>
        <HeroSentaPua linha="Cantinas, loja, café e ximboca do 1/10 GpAv. Peça, pague no PIX e acompanhe sua conta.">
          <div className="grid grid-cols-2 gap-2.5 max-w-sm">
            <Link
              to="/login"
              className="min-h-[48px] inline-flex items-center justify-center rounded-xl bg-white text-noite font-semibold hover:bg-noite-texto transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              Entrar
            </Link>
            <Link
              to="/cadastro"
              className="min-h-[48px] inline-flex items-center justify-center rounded-xl border border-white/40 text-white font-semibold hover:bg-noite-3 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              Criar conta
            </Link>
          </div>
        </HeroSentaPua>

        <h2 className="text-[15px] font-semibold text-noite mb-3">O que você quer fazer?</h2>
        <AtalhosHome />
        <p className="text-sm text-texto-fraco mt-4">
          Para comprar é preciso entrar na conta. Visitantes de outros esquadrões também podem se cadastrar.
        </p>
      </div>
    </AppLayout>
  );
}
