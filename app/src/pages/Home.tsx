import { Link } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { Button } from '../components/ui/Button';
import { useUserAuth } from '../hooks/useUserAuth';
import { Dashboard } from './Dashboard';

export function Home() {
  const { user } = useUserAuth();

  if (user) return <Dashboard />;

  return (
    <AppLayout>
      <div className="max-w-sm mx-auto py-12 text-center animate-fade-in">
        <img src="/logo.png" alt="1/10 GpAv" className="w-32 h-32 mx-auto mb-6 object-contain" />
        <h1 className="font-display text-4xl sm:text-5xl text-azul tracking-wider">SENTA PUA</h1>
        <div className="w-20 h-[2px] bg-azul mx-auto mt-4 mb-6" />
        <p className="text-texto text-base mb-2">
          Bem-vindo ao app do 1/10 GpAv
        </p>
        <p className="text-texto-fraco text-sm mb-8">
          Faça login para acessar seu dashboard, caixinha do café e histórico de pedidos.
        </p>
        <div className="space-y-3">
          <Link to="/login">
            <Button size="lg" className="w-full">Entrar</Button>
          </Link>
          <Link to="/cadastro">
            <Button variant="outline" size="lg" className="w-full">Cadastrar</Button>
          </Link>
        </div>
      </div>
    </AppLayout>
  );
}
