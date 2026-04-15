import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { Button } from '../components/ui/Button';
import { usePixPolling } from '../hooks/usePixPolling';
import { api } from '../services/api';
import { gerarPayloadPix } from '../services/pix';

const FRASES_PAGOU = [
  'Valeu, militar! Um Leão sempre honra suas dívidas!',
  'Pagamento registrado! Você é exemplo pro esquadrão!',
  'PIX confirmado! Moral lá em cima, militar!',
  'Boa, militar! Rápido no gatilho e no PIX!',
  'Recebido! O 1/10 GpAv agradece, guerreiro!',
];

export function PixPage() {
  const { pedidoId } = useParams<{ pedidoId: string }>();
  const { pedido, pago } = usePixPolling(pedidoId);
  const navigate = useNavigate();
  const [copiadoCodigo, setCopiadoCodigo] = useState(false);
  const [copiadoEmail, setCopiadoEmail] = useState(false);
  const [saiuDoApp, setSaiuDoApp] = useState(false);
  const [mostrarConfirmacao, setMostrarConfirmacao] = useState(false);
  const [frase] = useState(() => FRASES_PAGOU[Math.floor(Math.random() * FRASES_PAGOU.length)]);
  const [pixConfig, setPixConfig] = useState({ chave: '', whatsapp: '' });

  useEffect(() => {
    api.get<Record<string, string>>('/api/config').then(c => {
      setPixConfig({ chave: c.pix_guloseimas_chave || '', whatsapp: c.pix_guloseimas_whatsapp || '' });
    }).catch(() => {});
  }, []);

  const pixPayload = useMemo(() => {
    if (!pedido) return null;
    return gerarPayloadPix(pedido.total);
  }, [pedido]);

  // Detectar quando o militar sai e volta pro app
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        setSaiuDoApp(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  useEffect(() => {
    if (pago) {
      const t = setTimeout(() => navigate('/obrigado', { state: { nome: 'MILITAR', metodo: 'pix' } }), 2000);
      return () => clearTimeout(t);
    }
  }, [pago, navigate]);

  const copiarCodigo = async () => {
    if (!pixPayload) return;
    await navigator.clipboard.writeText(pixPayload);
    setCopiadoCodigo(true);
    setTimeout(() => setCopiadoCodigo(false), 3000);
  };

  const copiarEmail = async () => {
    await navigator.clipboard.writeText(pixConfig.chave);
    setCopiadoEmail(true);
    setTimeout(() => setCopiadoEmail(false), 3000);
  };

  const confirmarPagamento = async () => {
    try {
      await api.put(`/api/pedidos/${pedidoId}/confirmar-pagamento`, {});
    } catch {
      // mesmo se falhar, mostra confirmação — admin pode confirmar depois
    }
    setMostrarConfirmacao(true);
  };

  const enviarComprovante = () => {
    const valor = pedido ? `R$ ${pedido.total.toFixed(2)}` : '';
    const msg = `Comprovante PIX - Pedido #${pedidoId}\nValor: ${valor}\n\n_Anexe o comprovante do banco abaixo_`;
    window.open(`https://wa.me/${pixConfig.whatsapp}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  if (mostrarConfirmacao) {
    return (
      <AppLayout>
        <div className="text-center py-8 animate-fade-in">
          <div className="w-20 h-20 mx-auto rounded-full bg-green-50 border border-green-200 flex items-center justify-center mb-5">
            <svg className="w-10 h-10 text-verde" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="font-display text-2xl text-azul tracking-wider mb-3">VALEU, MILITAR!</h2>
          <p className="text-texto-fraco italic px-6 text-sm leading-relaxed mb-6">"{frase}"</p>

          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-4 text-left">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-amber-700 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>
              <div>
                <p className="text-sm font-medium text-amber-900 mb-1">Envie o comprovante para a RP</p>
                <p className="text-xs text-amber-700">O pagamento só é validado com o comprovante oficial do banco.</p>
              </div>
            </div>
          </div>

          <Button variant="success" size="lg" className="w-full mb-3" onClick={enviarComprovante}>
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Enviar comprovante no WhatsApp
            </span>
          </Button>

          <button onClick={() => navigate('/')} className="text-texto-fraco text-sm underline hover:text-texto">
            Voltar ao catálogo
          </button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="text-center py-6 animate-fade-in">
        {pago ? (
          <div className="animate-bounce">
            <div className="w-20 h-20 mx-auto rounded-full bg-green-50 border border-green-200 flex items-center justify-center mb-4">
              <svg className="w-10 h-10 text-verde" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
            </div>
            <h2 className="font-display text-2xl text-verde tracking-wider">PAGAMENTO CONFIRMADO!</h2>
          </div>
        ) : (
          <>
            <h1 className="font-display text-2xl text-azul tracking-wider mb-2">PAGAMENTO PIX</h1>
            {pedido && <div className="font-display text-4xl text-azul tracking-wider my-6">R$ {pedido.total.toFixed(2)}</div>}

            <div className="bg-white rounded-2xl p-5 mb-4 border border-borda shadow-sm text-left">
              <div className="flex items-center gap-3 mb-3">
                <span className="w-7 h-7 rounded-full bg-verde text-white text-sm font-bold flex items-center justify-center">1</span>
                <span className="text-sm font-medium">Copie o código PIX</span>
              </div>
              <Button variant="success" size="lg" className="w-full" onClick={copiarCodigo} disabled={!pixPayload}>
                {copiadoCodigo ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    Código copiado!
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    Copiar código Pix Copia e Cola
                  </span>
                )}
              </Button>
            </div>

            <div className="bg-white rounded-2xl p-5 mb-4 border border-borda shadow-sm text-left">
              <div className="flex items-center gap-3 mb-2">
                <span className="w-7 h-7 rounded-full bg-verde text-white text-sm font-bold flex items-center justify-center">2</span>
                <span className="text-sm font-medium">Abra o app do seu banco</span>
              </div>
              <p className="text-xs text-texto-fraco ml-10">Vá em PIX &rarr; Pagar &rarr; Copia e Cola e cole o código</p>
            </div>

            {/* Botão JÁ PAGUEI aparece quando o militar volta pro app */}
            {saiuDoApp && (
              <div className="bg-white rounded-2xl p-5 mb-4 border-2 border-verde shadow-sm animate-slide-up">
                <p className="text-sm font-medium text-texto mb-3">Já fez o PIX?</p>
                <Button variant="success" size="lg" className="w-full" onClick={confirmarPagamento}>
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    JÁ PAGUEI
                  </span>
                </Button>
              </div>
            )}

            {/* Chave PIX email */}
            <div className="bg-white rounded-2xl p-5 mb-6 border border-borda shadow-sm">
              <p className="text-xs text-texto-fraco mb-3 uppercase tracking-wider">Ou pague pela chave PIX (e-mail)</p>
              <div className="flex items-center justify-center gap-2 bg-fundo rounded-xl py-3 px-4">
                <span className="text-sm text-azul font-medium truncate">{pixConfig.chave}</span>
                <button onClick={copiarEmail} className="shrink-0 p-2 rounded-lg hover:bg-white transition-colors" title="Copiar e-mail">
                  {copiadoEmail ? (
                    <svg className="w-4 h-4 text-verde" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  ) : (
                    <svg className="w-4 h-4 text-texto-fraco" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                  )}
                </button>
              </div>
              {copiadoEmail && <p className="text-verde text-xs mt-2">E-mail copiado!</p>}
            </div>

            {!saiuDoApp && (
              <div className="flex items-center justify-center gap-2 text-sm text-texto-fraco mb-4">
                <div className="w-2 h-2 rounded-full bg-verde animate-pulse" />
                Aguardando confirmação...
              </div>
            )}

            <button onClick={() => navigate('/')} className="text-texto-fraco text-sm underline hover:text-texto">Cancelar e voltar</button>
          </>
        )}
      </div>
    </AppLayout>
  );
}
