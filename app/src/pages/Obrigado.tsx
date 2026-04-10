import { useLocation, useNavigate } from 'react-router-dom';
import { PublicLayout } from '../components/Layout';
import { Button } from '../components/ui/Button';

export function Obrigado() {
  const location = useLocation();
  const navigate = useNavigate();
  const nome = (location.state as { nome?: string })?.nome || 'Piloto';

  return (
    <PublicLayout>
      <div className="text-center py-12">
        <div className="w-20 h-20 mx-auto rounded-full bg-azul/10 flex items-center justify-center mb-4">
          <svg className="w-10 h-10 text-azul" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-azul mb-2">Pedido registrado, {nome}!</h1>
        <p className="text-gray-500 mb-8">Valeu pela preferência.</p>
        <Button size="lg" onClick={() => navigate('/')}>Novo pedido</Button>
      </div>
    </PublicLayout>
  );
}
