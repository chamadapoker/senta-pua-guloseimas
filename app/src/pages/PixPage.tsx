import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Icon } from '../components/ui/Icon';
import { PageHeader } from '../components/ui/PageHeader';
import { usePixPolling } from '../hooks/usePixPolling';
import { useCopiar } from '../hooks/useCopiar';
import { api } from '../services/api';
import { getConfig } from '../services/config';
import { gerarPayloadPix } from '../services/pix';

const FRASES_PAGOU = [
  'Valeu, militar! Um Leão sempre honra suas dívidas!',
  'Pagamento registrado! Você é exemplo pro esquadrão!',
  'PIX confirmado! Moral lá em cima, militar!',
  'Boa, militar! Rápido no gatilho e no PIX!',
  'Recebido! O 1/10 GpAv agradece, guerreiro!',
];

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function PixPage() {
  const { pedidoId } = useParams<{ pedidoId: string }>();
  const { pedido, pago, erro: erroPolling, expirado } = usePixPolling(pedidoId);
  const { copiar, modalCopiaManual } = useCopiar();
  const navigate = useNavigate();
  const [copiadoCodigo, setCopiadoCodigo] = useState(false);
  const [copiadoEmail, setCopiadoEmail] = useState(false);
  const [saiuDoApp, setSaiuDoApp] = useState(false);
  const [mostrarConfirmacao, setMostrarConfirmacao] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [frase] = useState(() => FRASES_PAGOU[Math.floor(Math.random() * FRASES_PAGOU.length)]);
  const [erroConfirmar, setErroConfirmar] = useState('');
  const [pixConfig, setPixConfig] = useState({ chave: '', nome: '', cidade: '', whatsapp: '' });
  const [configStatus, setConfigStatus] = useState<'carregando' | 'ok' | 'erro'>('carregando');

  const carregarConfig = () => {
    setConfigStatus('carregando');
    getConfig().then(c => {
      setPixConfig({
        chave: c.pix_guloseimas_chave || '',
        nome: c.pix_guloseimas_nome || '',
        cidade: c.pix_guloseimas_cidade || 'ANAPOLIS',
        whatsapp: c.pix_guloseimas_whatsapp || '',
      });
      setConfigStatus('ok');
    }).catch(() => setConfigStatus('erro'));
  };

  useEffect(() => { carregarConfig(); }, []);

  // Só gera o código com a chave carregada (senão sairia um PIX sem chave)
  const pixPayload = useMemo(() => {
    if (!pedido || !pixConfig.chave) return null;
    return gerarPayloadPix(pedido.total, { chave: pixConfig.chave, nome: pixConfig.nome, cidade: pixConfig.cidade });
  }, [pedido, pixConfig]);

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
      const t = setTimeout(() => navigate('/obrigado', { state: { nome: pedido?.nome_guerra || 'MILITAR', metodo: 'pix' } }), 2000);
      return () => clearTimeout(t);
    }
  }, [pago, navigate]);

  const copiarCodigo = async () => {
    if (!pixPayload) return;
    if (!(await copiar(pixPayload))) return;
    setCopiadoCodigo(true);
    setTimeout(() => setCopiadoCodigo(false), 3000);
  };

  const copiarEmail = async () => {
    if (!pixConfig.chave) return;
    if (!(await copiar(pixConfig.chave))) return;
    setCopiadoEmail(true);
    setTimeout(() => setCopiadoEmail(false), 3000);
  };

  const confirmarPagamento = async () => {
    if (confirmando) return;
    setConfirmando(true);
    setErroConfirmar('');
    try {
      await api.put(`/api/pedidos/${pedidoId}/confirmar-pagamento`, {});
      setMostrarConfirmacao(true);
    } catch (e) {
      setErroConfirmar(
        (e instanceof Error ? e.message : 'Erro ao confirmar') +
        '. Tente de novo ou envie o comprovante para a RP.'
      );
    } finally {
      setConfirmando(false);
    }
  };

  const enviarComprovante = () => {
    const valor = pedido ? brl(pedido.total) : '';
    const msg = `Comprovante PIX - Pedido #${pedidoId}\nValor: ${valor}\n\n_Anexe o comprovante do banco abaixo_`;
    window.open(`https://wa.me/${pixConfig.whatsapp}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const valorFmt = pedido ? brl(pedido.total) : null;

  if (mostrarConfirmacao) {
    return (
      <AppLayout>
        <div className="max-w-md mx-auto py-6 animate-fade-in">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-green-50 border border-green-200 flex items-center justify-center mb-4 text-verde-escuro">
              <Icon name="check" size={32} />
            </div>
            <h1 className="font-display text-4xl text-noite tracking-wide leading-none">Valeu, militar!</h1>
            <p className="text-texto-fraco italic px-4 text-sm leading-relaxed mt-3">"{frase}"</p>
          </div>

          <Card size="lg" className="mt-6">
            <h2 className="font-semibold text-texto flex items-center gap-2">
              <Icon name="info" size={18} className="text-azul" /> Falta um passo
            </h2>
            <p className="text-sm text-texto-fraco mt-1.5">
              Envie o comprovante do banco para a RP. O pagamento só é validado com o comprovante oficial.
            </p>
            {valorFmt && (
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-borda">
                <span className="text-sm text-texto-fraco">Valor pago</span>
                <span className="font-display text-2xl leading-none tracking-wide text-noite">{valorFmt}</span>
              </div>
            )}
          </Card>

          <Button variant="success" size="lg" className="w-full mt-4" onClick={enviarComprovante}>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Enviar comprovante no WhatsApp
          </Button>
          <Button variant="ghost" size="lg" className="w-full mt-3" onClick={() => navigate('/')}>
            Voltar ao início
          </Button>
        </div>
      </AppLayout>
    );
  }

  if (pago) {
    return (
      <AppLayout>
        <div role="status" className="max-w-md mx-auto py-16 text-center animate-fade-in">
          <div className="w-20 h-20 mx-auto rounded-full bg-verde text-white flex items-center justify-center mb-5 animate-scale-in">
            <Icon name="check" size={40} />
          </div>
          <h1 className="font-display text-4xl text-verde-escuro tracking-wide leading-none">Pagamento confirmado</h1>
          {valorFmt && <p className="font-display text-3xl text-noite tracking-wide mt-3">{valorFmt}</p>}
          <p className="text-sm text-texto-fraco mt-3">Só um instante...</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-md mx-auto animate-fade-in">
        <PageHeader title="Pagar com PIX" subtitle={pedidoId ? `Pedido #${pedidoId.slice(0, 8)}` : undefined} />

        {erroPolling && (
          <p role="alert" className="text-vermelho text-sm mb-4 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            Não foi possível consultar este pedido (pode ter sido removido ou sua sessão expirou). Se já pagou, envie o comprovante para a RP.
          </p>
        )}
        {expirado && !erroPolling && (
          <p className="text-amber-900 text-sm mb-4 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            Paramos de verificar o pagamento automaticamente. Se já pagou, toque em "Já paguei" ou recarregue a página.
          </p>
        )}
        {configStatus === 'erro' && (
          <div role="alert" className="text-vermelho text-sm mb-4 bg-red-50 border border-red-200 rounded-xl px-3 py-2 flex items-center justify-between gap-3 flex-wrap">
            <span>Não foi possível carregar os dados do PIX.</span>
            <Button variant="chip-danger" size="sm" onClick={carregarConfig}><Icon name="refresh" size={14} /> Tentar de novo</Button>
          </div>
        )}
        {configStatus === 'ok' && !pixConfig.chave && (
          <p role="alert" className="text-vermelho text-sm mb-4 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            Chave PIX não configurada. Fale com o responsável pela cantina.
          </p>
        )}

        {/* Valor, QR e copia-e-cola */}
        <Card size="lg" className="text-center">
          <p className="text-sm text-texto-fraco">Valor a pagar</p>
          <p className="font-display text-6xl leading-none tracking-wide text-noite mt-1 min-h-[3.75rem]">
            {valorFmt ?? <span className="inline-block w-40 h-12 rounded-lg bg-fundo-elevado animate-pulse align-middle" aria-label="Carregando valor" />}
          </p>

          <div className="mx-auto mt-5 w-[188px] h-[188px] rounded-2xl border border-borda p-2.5 bg-white flex items-center justify-center">
            {pixPayload ? (
              <QRCodeSVG value={pixPayload} size={166} level="M" marginSize={0} title="QR Code do PIX" />
            ) : (
              <span className="text-xs text-texto-fraco px-4">
                {configStatus === 'carregando' || !pedido ? 'Gerando o código PIX...' : 'Código indisponível'}
              </span>
            )}
          </div>

          <Button variant="success" size="lg" className="w-full mt-5 min-h-[56px] text-[17px]" onClick={copiarCodigo} disabled={!pixPayload}>
            {copiadoCodigo ? (
              <><Icon name="check" size={20} /> Código copiado</>
            ) : !pixPayload ? (
              <>Carregando dados do PIX...</>
            ) : (
              <><Icon name="document" size={20} /> Copiar código PIX</>
            )}
          </Button>
          <p className="sr-only" aria-live="polite">{copiadoCodigo ? 'Código PIX copiado' : ''}</p>

          {!saiuDoApp && !erroPolling && !expirado && (
            <p className="flex items-center justify-center gap-2 text-sm text-texto-fraco mt-4">
              <span className="w-2 h-2 rounded-full bg-verde animate-pulse" aria-hidden="true" />
              Aguardando a confirmação do pagamento
            </p>
          )}
        </Card>

        {/* Como pagar em 3 passos */}
        <ol className="mt-5 space-y-3">
          {[
            'Abra o app do seu banco e entre na área PIX.',
            'Escolha "PIX copia e cola" e cole o código, ou leia o QR Code.',
            'Pague, volte aqui e toque em "Já paguei".',
          ].map((t, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="w-7 h-7 shrink-0 rounded-full bg-noite text-white font-display text-base flex items-center justify-center">{i + 1}</span>
              <span className="text-[15px] text-texto pt-0.5">{t}</span>
            </li>
          ))}
        </ol>

        {/* Já paguei: sempre visível, destacado quando o militar volta do app do banco */}
        <Card size="lg" className={`mt-5 ${saiuDoApp ? '!border-2 !border-verde animate-slide-up' : ''}`}>
          <p className="font-medium text-texto mb-3">{saiuDoApp ? 'Voltou do banco? Confirme aqui.' : 'Já fez o PIX?'}</p>
          <Button variant="success" size="lg" className="w-full" onClick={confirmarPagamento} disabled={confirmando}>
            <Icon name="check" size={20} />
            {confirmando ? 'Confirmando...' : 'Já paguei'}
          </Button>
          {erroConfirmar && <p role="alert" className="text-vermelho text-sm mt-2">{erroConfirmar}</p>}
        </Card>

        {/* Chave PIX */}
        <Card className="mt-4">
          <p className="text-sm text-texto-fraco mb-2">Prefere digitar? Use a chave PIX (e-mail):</p>
          <div className="flex items-center gap-2 bg-fundo-elevado border border-borda rounded-xl pl-3.5 pr-1 py-1">
            <span className="flex-1 min-w-0 text-[15px] text-noite font-medium truncate">
              {pixConfig.chave || (configStatus === 'carregando' ? 'Carregando...' : '—')}
            </span>
            <button
              type="button"
              onClick={copiarEmail}
              disabled={!pixConfig.chave}
              className="shrink-0 min-h-[44px] px-3 inline-flex items-center gap-1.5 rounded-lg text-sm font-medium text-azul hover:bg-white disabled:opacity-40 outline-none focus-visible:ring-2 focus-visible:ring-azul/40"
            >
              <Icon name={copiadoEmail ? 'check' : 'document'} size={16} className={copiadoEmail ? 'text-verde-escuro' : ''} />
              {copiadoEmail ? 'Copiada' : 'Copiar'}
            </button>
          </div>
        </Card>

        <div className="text-center mt-5 mb-2">
          <button onClick={() => navigate('/')} className="min-h-[44px] px-3 text-texto-fraco text-sm underline hover:text-texto">
            Voltar ao início sem pagar agora
          </button>
        </div>
      </div>
      {modalCopiaManual}
    </AppLayout>
  );
}
