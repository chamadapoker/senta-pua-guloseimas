import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PublicLayout } from '../components/Layout';
import { Button } from '../components/ui/Button';
import { usePixPolling } from '../hooks/usePixPolling';
import { gerarPayloadPix } from '../services/pix';

const PIX_EMAIL = 'sandraobregon12@gmail.com';

export function PixPage() {
  const { pedidoId } = useParams<{ pedidoId: string }>();
  const { pedido, pago } = usePixPolling(pedidoId);
  const navigate = useNavigate();
  const [copiadoCodigo, setCopiadoCodigo] = useState(false);
  const [copiadoEmail, setCopiadoEmail] = useState(false);

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

  const copiarCodigo = async () => {
    if (!pixPayload) return;
    await navigator.clipboard.writeText(pixPayload);
    setCopiadoCodigo(true);
    setTimeout(() => setCopiadoCodigo(false), 3000);
  };

  const copiarEmail = async () => {
    await navigator.clipboard.writeText(PIX_EMAIL);
    setCopiadoEmail(true);
    setTimeout(() => setCopiadoEmail(false), 3000);
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
            <h1 className="font-display text-2xl text-white tracking-wider mb-2">PAGAMENTO PIX</h1>

            {pedido && (
              <div className="font-display text-4xl text-dourado tracking-wider my-6">
                R$ {pedido.total.toFixed(2)}
              </div>
            )}

            {/* Passo 1: Copiar código PIX */}
            <div className="bg-fundo-card rounded-2xl p-5 mb-4 border border-borda text-left">
              <div className="flex items-center gap-3 mb-3">
                <span className="w-7 h-7 rounded-full bg-vermelho text-white text-sm font-bold flex items-center justify-center">1</span>
                <span className="text-sm font-medium text-texto">Copie o código PIX</span>
              </div>
              <Button
                variant="danger"
                size="lg"
                className="w-full"
                onClick={copiarCodigo}
                disabled={!pixPayload}
              >
                {copiadoCodigo ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Código copiado!
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copiar código Pix Copia e Cola
                  </span>
                )}
              </Button>
            </div>

            {/* Passo 2: Abrir app do banco */}
            <div className="bg-fundo-card rounded-2xl p-5 mb-4 border border-borda text-left">
              <div className="flex items-center gap-3 mb-2">
                <span className="w-7 h-7 rounded-full bg-vermelho text-white text-sm font-bold flex items-center justify-center">2</span>
                <span className="text-sm font-medium text-texto">Abra o app do seu banco</span>
              </div>
              <p className="text-xs text-texto-fraco ml-10">Vá em PIX &rarr; Pagar &rarr; Copia e Cola e cole o código</p>
            </div>

            {/* Alternativa: chave PIX email */}
            <div className="bg-fundo-card rounded-2xl p-5 mb-6 border border-borda">
              <p className="text-xs text-texto-fraco mb-3 uppercase tracking-wider">Ou pague pela chave PIX (e-mail)</p>
              <div className="flex items-center justify-center gap-2 bg-fundo-elevado rounded-xl py-3 px-4">
                <span className="text-sm text-dourado font-medium truncate">{PIX_EMAIL}</span>
                <button
                  onClick={copiarEmail}
                  className="shrink-0 p-2 rounded-lg hover:bg-fundo-card transition-colors"
                  title="Copiar e-mail"
                >
                  {copiadoEmail ? (
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
              {copiadoEmail && <p className="text-emerald-400 text-xs mt-2">E-mail copiado!</p>}
            </div>

            <div className="flex items-center justify-center gap-2 text-sm text-texto-fraco mb-4">
              <div className="w-2 h-2 rounded-full bg-dourado animate-pulse" />
              Aguardando confirmação...
            </div>

            <button onClick={() => navigate('/')} className="text-texto-fraco text-sm underline hover:text-texto">
              Cancelar e voltar
            </button>
          </>
        )}
      </div>
    </PublicLayout>
  );
}
