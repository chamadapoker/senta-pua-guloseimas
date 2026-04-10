import { useLocation, useNavigate } from 'react-router-dom';
import { PublicLayout } from '../components/Layout';
import { Button } from '../components/ui/Button';

const FRASES_PIX = [
  'Pagamento na hora, moral lá em cima!',
  'PIX feito, missão cumprida!',
  'Rápido no gatilho e no PIX!',
];

const FRASES_FIADO = [
  'Um Leão sempre paga suas dívidas. Já um Centauro... não sabemos!',
  'Fiado anotado! Lembre-se: a cantina não esquece... e o WhatsApp também não.',
  'Dívida registrada, piloto. Um Senta Pua sempre paga o que deve!',
  'Anotado no fiado! Mas lembre-se: aqui não tem anistia.',
  'Fiado feito. A conta não prescreve, soldado!',
  'Registrado! Um devedor honrado paga antes da próxima missão.',
];

function fraseAleatoria(metodo: string): string {
  const lista = metodo === 'fiado' ? FRASES_FIADO : FRASES_PIX;
  return lista[Math.floor(Math.random() * lista.length)];
}

export function Obrigado() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as { nome?: string; metodo?: string } | null;
  const nome = state?.nome || 'PILOTO';
  const metodo = state?.metodo || 'fiado';
  const frase = fraseAleatoria(metodo);

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
        <div className="w-12 h-[2px] bg-azul mx-auto mt-4 mb-6" />
        <p className="text-texto-fraco italic px-4 text-sm leading-relaxed mb-8">"{frase}"</p>
        <Button variant="success" size="lg" onClick={() => navigate('/')}>Novo pedido</Button>
      </div>
    </PublicLayout>
  );
}
