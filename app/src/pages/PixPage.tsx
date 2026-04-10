import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PublicLayout } from '../components/Layout';
import { usePixPolling } from '../hooks/usePixPolling';

export function PixPage() {
  const { pedidoId } = useParams<{ pedidoId: string }>();
  const { pedido, pago } = usePixPolling(pedidoId);
  const navigate = useNavigate();

  useEffect(() => {
    if (pago) {
      const timer = setTimeout(() => navigate('/obrigado', { state: { nome: 'Piloto' } }), 2000);
      return () => clearTimeout(timer);
    }
  }, [pago, navigate]);

  return (
    <PublicLayout>
      <div className="text-center py-6">
        {pago ? (
          <div className="animate-bounce">
            <div className="w-20 h-20 mx-auto rounded-full bg-green-100 flex items-center justify-center mb-4">
              <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-green-600">Pagamento confirmado!</h2>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-bold text-azul mb-6">Pagamento PIX</h1>

            <div className="bg-white rounded-xl p-6 mb-4">
              <div className="w-48 h-48 mx-auto bg-gray-100 rounded-lg flex items-center justify-center mb-4">
                <div className="text-center text-gray-400 text-sm px-4">
                  QR Code PIX será configurado em breve
                </div>
              </div>

              {pedido && (
                <div className="mt-4">
                  <div className="text-2xl font-bold text-azul">R$ {pedido.total.toFixed(2)}</div>
                  <p className="text-gray-500 text-sm mt-1">Escaneie o QR Code no seu banco</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
              <div className="w-2 h-2 rounded-full bg-azul animate-pulse" />
              Aguardando pagamento...
            </div>

            <button
              onClick={() => navigate('/')}
              className="mt-6 text-gray-400 text-sm underline"
            >
              Cancelar e voltar
            </button>
          </>
        )}
      </div>
    </PublicLayout>
  );
}
