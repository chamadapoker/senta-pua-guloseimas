import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { PublicLayout } from '../components/Layout';
import { usePixPolling } from '../hooks/usePixPolling';
import { gerarPayloadPix } from '../services/pix';

const PIX_EMAIL = 'sandraobregon12@gmail.com';

export function PixPage() {
  const { pedidoId } = useParams<{ pedidoId: string }>();
  const { pedido, pago } = usePixPolling(pedidoId);
  const navigate = useNavigate();
  const [copiado, setCopiado] = useState(false);
  const [copiadoPix, setCopiadoPix] = useState(false);

  const pixPayload = useMemo(() => {
    if (!pedido) return null;
    return gerarPayloadPix(pedido.total);
  }, [pedido]);

  useEffect(() => {
    if (pago) {
      const timer = setTimeout(() => navigate('/obrigado', { state: { nome: 'PILOTO' } }), 2000);
      return () => clearTimeout(timer);
    }
  }, [pago, navigate]);

  const copiarEmail = async () => {
    await navigator.clipboard.writeText(PIX_EMAIL);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const copiarCodigoPix = async () => {
    if (!pixPayload) return;
    await navigator.clipboard.writeText(pixPayload);
    setCopiadoPix(true);
    setTimeout(() => setCopiadoPix(false), 2000);
  };

  return (
    <PublicLayout>
      <div className="text-center py-6 animate-fade-in">
        {pago ? (
          <div className="animate-bounce">
            <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mb-4">
              <svg className="w-10 h-10 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="font-display text-2xl text-emerald-400 tracking-wider">PAGAMENTO CONFIRMADO!</h2>
          </div>
        ) : (
          <>
            <h1 className="font-display text-2xl text-white tracking-wider mb-6">PAGAMENTO PIX</h1>

            <div className="bg-fundo-card rounded-2xl p-6 mb-5 border border-borda">
              {pixPayload ? (
                <div className="flex flex-col items-center">
                  <div className="bg-white p-3 rounded-xl">
                    <QRCodeSVG value={pixPayload} size={200} level="M" />
                  </div>
                </div>
              ) : (
                <div className="w-48 h-48 mx-auto bg-fundo-elevado rounded-xl animate-pulse" />
              )}

              {pedido && (
                <div className="mt-5">
                  <div className="font-display text-3xl text-dourado tracking-wider">R$ {pedido.total.toFixed(2)}</div>
                  <p className="text-texto-fraco text-sm mt-2">Escaneie o QR Code no app do seu banco</p>
                </div>
              )}
            </div>

            {/* Chave PIX com botão copiar */}
            <div className="bg-fundo-card rounded-xl p-4 mb-4 border border-borda">
              <p className="text-xs text-texto-fraco mb-2">Chave PIX (e-mail)</p>
              <div className="flex items-center justify-center gap-2">
                <span className="text-sm text-dourado font-medium">{PIX_EMAIL}</span>
                <button
                  onClick={copiarEmail}
                  className="p-1.5 rounded-lg hover:bg-fundo-elevado transition-colors"
                  title="Copiar e-mail"
                >
                  {copiado ? (
                    <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-texto-fraco" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
              </div>
              {copiado && <p className="text-emerald-400 text-xs mt-1">Copiado!</p>}
            </div>

            {/* Copia e cola */}
            {pixPayload && (
              <button
                onClick={copiarCodigoPix}
                className="w-full bg-fundo-card border border-borda rounded-xl py-3 px-4 text-sm text-texto-fraco hover:text-texto hover:border-dourado/30 transition-all mb-4"
              >
                {copiadoPix ? (
                  <span className="text-emerald-400">Código PIX copiado!</span>
                ) : (
                  <span>Copiar código PIX (copia e cola)</span>
                )}
              </button>
            )}

            <div className="flex items-center justify-center gap-2 text-sm text-texto-fraco">
              <div className="w-2 h-2 rounded-full bg-dourado animate-pulse" />
              Aguardando pagamento...
            </div>

            <button onClick={() => navigate('/')} className="mt-6 text-texto-fraco text-sm underline hover:text-texto">
              Cancelar e voltar
            </button>
          </>
        )}
      </div>
    </PublicLayout>
  );
}
