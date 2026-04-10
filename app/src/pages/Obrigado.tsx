import { useLocation, useNavigate } from 'react-router-dom';
import { PublicLayout } from '../components/Layout';
import { Button } from '../components/ui/Button';

export function Obrigado() {
  const location = useLocation();
  const navigate = useNavigate();
  const nome = (location.state as { nome?: string })?.nome || 'PILOTO';

  return (
    <PublicLayout>
      <div className="text-center py-12 animate-fade-in">
        <div className="w-20 h-20 mx-auto rounded-full bg-green-50 border border-green-200 flex items-center justify-center mb-5">
          <svg className="w-10 h-10 text-verde" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="font-display text-3xl text-azul tracking-wider mb-2">PEDIDO REGISTRADO</h1>
        <p className="text-vermelho font-display text-xl tracking-wide">{nome}</p>
        <div className="w-12 h-[2px] bg-azul mx-auto mt-4 mb-8" />
        <p className="text-texto-fraco mb-8">Valeu pela preferência, piloto!</p>
        <Button variant="success" size="lg" onClick={() => navigate('/')}>Novo pedido</Button>
      </div>
    </PublicLayout>
  );
}
