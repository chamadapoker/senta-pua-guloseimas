import { useNavigate, useLocation } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { Button } from '../components/ui/Button';

export function CadastroEscolha() {
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo || '/';

  return (
    <AppLayout>
      <div className="max-w-sm mx-auto py-10 animate-fade-in">
        <h1 className="font-display text-3xl text-azul tracking-wider mb-2 text-center">CADASTRO</h1>
        <p className="text-sm text-texto-fraco text-center mb-8">Você é do 1/10 GpAv?</p>

        <div className="space-y-3">
          <Button size="lg" className="w-full" onClick={() => navigate('/cadastro/militar', { state: { returnTo } })}>
            Sim, sou do 1/10 GpAv
          </Button>
          <Button variant="outline" size="lg" className="w-full" onClick={() => navigate('/cadastro/visitante', { state: { returnTo } })}>
            Sou visitante de outro esquadrão
          </Button>
        </div>

        <p className="text-center text-xs text-texto-fraco mt-8">
          Visitantes têm acesso por 30 dias. Para estender, fale com o admin da cantina.
        </p>
      </div>
    </AppLayout>
  );
}
